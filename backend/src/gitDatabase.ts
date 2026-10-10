import { dirname, resolve } from "path"
import { fileURLToPath } from "url"
import { existsSync, mkdirSync } from "fs"
import { execFile, execFileSync } from "node:child_process"
import { cleanMerge } from "@colcom/shared"

import { IContent } from "@/models/content"
import logger from "@/logger"
import { ValidationError } from "./errors"

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DB_PATH || resolve(__dirname, "db/")

if (!existsSync(dbPath)) {
  logger.info(`[gitDatabase.ts] Creating git db at "${dbPath}"`)
  mkdirSync(dbPath)
}
else
  logger.info(`[gitDatabase.ts] Loaded git db at "${dbPath}"`)

// Merges are computed without a working tree by `git merge-tree --write-tree`, added in git 2.38
const [major, minor] = (execFileSync("git", ["version"], { encoding: "utf-8" }).match(/(\d+)\.(\d+)/) ?? []).slice(1).map(Number)
if (!(major > 2 || (major === 2 && minor >= 38)))
  throw new Error(`[gitDatabase.ts] git 2.38 or newer is required (found ${major}.${minor})`)

const FILE = "main.html"
// Times a write is rebuilt on a branch that moved while it was being written (see advance)
const MAX_ATTEMPTS = 20

class GitError extends Error {
  constructor(public code: number | null, public stderr: string) {
    super(`git exited with ${code}: ${stderr.trim()}`)
  }
}

// Runs git in a topic's repo and resolves with its stdout. `input` is written to its stdin.
function git(repo: number | string, args: string[], { input, env }: { input?: string, env?: NodeJS.ProcessEnv } = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile("git", ["-C", `${dbPath}/${repo}`, ...args], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024, env: env && { ...process.env, ...env } },
      (err, stdout, stderr) => err ? reject(new GitError(typeof err.code === "number" ? err.code : null, stderr)) : resolve(stdout))
    // Commands that don't read stdin may exit before it's written (EPIPE); their exit status tells what happened
    child.stdin!.on("error", () => { })
    child.stdin!.end(input)
  })
}

// Refs arrive from the URL, and a value such as "--output=..." would be parsed by git as an option
function validateCommit(commit: string) {
  if (!/^[0-9a-f]{7,40}$/.test(commit))
    throw new ValidationError({
      message: "Hash de commit inválido.",
      action: "Forneça um hash de commit válido.",
      stack: new Error().stack,
      errorLocationCode: "GIT:VALIDATE_COMMIT:INVALID_HASH",
      key: "hash"
    })
}

// The editor emits the whole document as a single line, and git diffs and merges line by line,
// so any two edits to the same post would conflict. Breaking the line after every block element
// makes each paragraph, heading, list item, etc. its own line. The browser's parser drops this
// whitespace between blocks, so the rendered document and the critiques' positions don't change.
// Code blocks are left untouched, since their whitespace is meaningful.
const BLOCK_END = /(<\/(?:p|h[1-6]|li|ul|ol|blockquote|table|thead|tbody|tr|chart)>|<hr>)\n*/g

export function formatHtml(html: string) {
  return html
    .split(/(<pre[\s\S]*?<\/pre>\n*)/)
    .map(part => part.startsWith("<pre") ? part.trimEnd() + "\n" : part.replace(BLOCK_END, "$1\n"))
    .join("")
}

// Repos are bare and written only through objects and refs, never a working tree or an index, so
// concurrent writes to the same repo can't disturb each other: objects are content addressed, and
// each write ends by moving one branch with a compare-and-swap (setRef).

// A tree holding the document, the repo's only file
async function writeTree(repo: number, body: string) {
  const blob = (await git(repo, ["hash-object", "-w", "--stdin"], { input: formatHtml(body) })).trim()
  return (await git(repo, ["mktree"], { input: `100644 blob ${blob}\t${FILE}\n` })).trim()
}

// Without an author, git's configured identity is used, as `git merge` did
async function writeCommit(repo: number, tree: string, parents: string[], message: string, author?: { username: string, email: string }) {
  const env = author && { GIT_AUTHOR_NAME: author.username, GIT_AUTHOR_EMAIL: author.email }
  const args = ["commit-tree", tree, ...parents.flatMap(parent => ["-p", parent]), "-m", message]
  return (await git(repo, args, { env })).trim()
}

// A branch's tip and its tree, read at once. Undefined if the branch doesn't exist.
async function tip(repo: number, branch: string) {
  const output = await git(repo, ["log", "-1", "--format=%H %T", `refs/heads/${branch}`, "--"]).catch(() => "")
  const [commit, tree] = output.trim().split(" ")
  return commit ? { commit, tree } : undefined
}

// Points a branch at a commit if it still points at `expected`; with no `expected`, only if the
// branch doesn't exist yet. Resolves false when another write moved the branch first.
async function setRef(repo: number, branch: string, commit: string, expected?: string) {
  try {
    await git(repo, ["update-ref", `refs/heads/${branch}`, commit, expected ?? ""])
    return true
  }
  catch (err) {
    if (err instanceof GitError && /cannot lock ref/.test(err.stderr))
      return false
    throw err
  }
}

// The last write queued for each branch ("<repo>/<branch>"), dropped once the queue drains
const queues = new Map<string, Promise<void>>()

// Runs this process' writes to one branch one after another. Racing for the branch instead made
// every write but one rebuild its commit each round: with 64 people editing one post, the load
// test saw 21% of edits give up with a 409 and the rest wait seconds, against none queued.
function queued<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const result = (queues.get(key) ?? Promise.resolve()).then(operation)
  // A failed write must not stop the ones queued after it
  const tail = result.then(() => { }, () => { })
  queues.set(key, tail)
  tail.then(() => {
    if (queues.get(key) === tail)
      queues.delete(key)
  })
  return result
}

// Builds a commit on a branch's current tip and moves the branch to it. Writes from this process
// are queued per branch; the compare-and-swap still guards against any other writer (another
// backend process, a person with a shell): if the branch moved meanwhile, the commit is rebuilt on
// the new tip after a random, growing delay, so the writers racing don't all collide again.
function advance(repo: number, branch: string, build: (head: { commit: string, tree: string }) => Promise<string>) {
  return queued(`${repo}/${branch}`, () => advanceNow(repo, branch, build))
}

async function advanceNow(repo: number, branch: string, build: (head: { commit: string, tree: string }) => Promise<string>) {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const head = await tip(repo, branch)
    if (!head)
      throw new Error(`[gitDatabase.ts] Branch "${branch}" not found in repo ${repo}`)

    const commit = await build(head)
    if (await setRef(repo, branch, commit, head.commit))
      return commit

    await new Promise(resolve => setTimeout(resolve, Math.random() * Math.min(10 * 2 ** attempt, 500)))
  }

  throw new ValidationError({
    message: "O texto foi alterado por outra pessoa ao mesmo tempo.",
    action: "Atualize a página e tente novamente.",
    statusCode: 409,
    stack: new Error().stack,
    errorLocationCode: "GIT:ADVANCE:TOO_MANY_ATTEMPTS"
  })
}

function branchExists(branch: string) {
  return new ValidationError({
    message: `O branch "${branch}" já existe.`,
    stack: new Error().stack,
    errorLocationCode: "GIT:BRANCH:ALREADY_EXISTS",
    statusCode: 409
  })
}

async function create(content: IContent, author: any) {
  const { parent_id, id, type, body } = content

  if (type === "critique")
    return

  const repo = Number(parent_id || id)

  if (type === "topic")
    await git(".", ["init", "--quiet", "--bare", "--initial-branch=main", String(repo)])

  const parent = type === "topic" ? undefined : (await tip(repo, "main"))?.commit
  const tree = await writeTree(repo, body || "")
  // Every post gets its own first commit, even one identical to the topic's text, to appear in its history
  const commit = await writeCommit(repo, tree, parent ? [parent] : [], type === "topic" ? "init topic" : `init post ${id}`, author)

  const branch = type === "topic" ? "main" : String(id)
  if (!(await setRef(repo, branch, commit)))
    throw branchExists(branch)
}

async function read(repo: number, commit: string) {
  validateCommit(commit)
  return await git(repo, ["show", `${commit}:${FILE}`])
}

async function update(content: IContent, author: any, body: string, message: string, interactionId: number | undefined) {
  const { parent_id, id } = content
  const repo = Number(parent_id)
  const tree = await writeTree(repo, body)

  const build = async (head: { commit: string, tree: string }) => {
    if (head.tree === tree)
      throw new ValidationError({
        message: "Nenhuma alteração foi feita no texto.",
        action: "Altere o conteúdo antes de enviar a edição.",
        stack: new Error().stack,
        errorLocationCode: "GIT:UPDATE:NO_CHANGES"
      })

    return await writeCommit(repo, tree, [head.commit], message, author)
  }

  if (interactionId === undefined)
    return await advance(repo, String(id), build)

  // A suggestion is a new branch from the post's tip, so nothing else can be writing to it
  const head = await tip(repo, String(id))
  if (!head)
    throw new Error(`[gitDatabase.ts] Branch "${id}" not found in repo ${repo}`)

  const commit = await build(head)
  const branch = `${id}_${interactionId}`
  if (!(await setRef(repo, branch, commit)))
    throw branchExists(branch)

  return commit
}

async function branch(content: IContent, commit: string) {
  const { parent_id, id } = content
  const repo = Number(parent_id)

  validateCommit(commit)

  const target = (await git(repo, ["rev-parse", "--verify", "--quiet", `${commit}^{commit}`]).catch(() => "")).trim()
  if (!target)
    throw new ValidationError({
      message: "Versão não encontrada.",
      action: "Forneça o hash de uma versão deste post.",
      stack: new Error().stack,
      errorLocationCode: "GIT:BRANCH:COMMIT_NOT_FOUND",
      key: "hash"
    })

  if (!(await setRef(repo, String(id), target)))
    throw branchExists(String(id))
}

// The three texts a merge combines: the post as it is (head), the suggestion, and the version the
// suggestion was made on (base)
async function sides(repo: number, head: string, commit: string) {
  const base = (await git(repo, ["merge-base", head, commit])).trim()
  const [headBody, baseBody, suggestionBody] = await Promise.all([head, base, commit].map(version => read(repo, version)))
  return {
    head: { commit: head, body: headBody },
    base: { commit: base, body: baseBody },
    suggestion: { commit, body: suggestionBody }
  }
}

async function mergeSides(content: IContent, commit: string) {
  const { parent_id, id } = content
  const repo = Number(parent_id)

  validateCommit(commit)

  const head = await tip(repo, String(id))
  if (!head)
    throw new Error(`[gitDatabase.ts] Branch "${id}" not found in repo ${repo}`)

  return await sides(repo, head.commit, commit)
}

// Merges a suggestion into its post and returns the merge commit. git refuses changes on adjacent
// lines too, so when it does, the texts are merged again by merge3 (shared/), which only refuses
// changes to the same lines; those are a 409 for the author to resolve. A `resolution` is the text
// the author settled on, against the post's version `head`: if the post moved since, it's a 409 too.
async function merge(content: IContent, commit: string, resolution?: { body: string, head: string }) {
  const { parent_id, id } = content
  const repo = Number(parent_id)

  validateCommit(commit)
  if (resolution)
    validateCommit(resolution.head)

  return await advance(repo, String(id), async head => {
    let tree

    if (resolution) {
      if (resolution.head !== head.commit)
        throw new ValidationError({
          message: "O post foi alterado enquanto os conflitos eram resolvidos.",
          action: "Resolva os conflitos novamente sobre a versão atual do post.",
          statusCode: 409,
          stack: new Error().stack,
          errorLocationCode: "GIT:MERGE:HEAD_MOVED"
        })

      tree = await writeTree(repo, resolution.body)
    }
    else
      try {
        tree = (await git(repo, ["merge-tree", "--write-tree", "--no-messages", head.commit, commit])).split("\n")[0]
      }
      catch (err) {
        // Exit status 1 means the merge has conflicts; anything else is a failure
        if (!(err instanceof GitError && err.code === 1))
          throw err

        const { base, head: ours, suggestion } = await sides(repo, head.commit, commit)
        const merged = cleanMerge(base.body, ours.body, suggestion.body)
        if (merged === undefined)
          throw new ValidationError({
            message: "A sugestão altera trechos que também foram alterados no post depois dela.",
            action: "Resolva os conflitos para aceitar a sugestão.",
            statusCode: 409,
            stack: new Error().stack,
            errorLocationCode: "GIT:MERGE:CONFLICT"
          })

        tree = await writeTree(repo, merged)
      }

    // The message `git merge` writes
    return await writeCommit(repo, tree, [head.commit, commit], `Merge commit '${commit}' into ${id}`)
  })
}

// Whether a commit is part of a post's own history, i.e. a version readers can see on its timeline.
// The topic's commits on main are ancestors of every post, but belong to none of them.
async function isInHistory(content: IContent, commit: string): Promise<boolean> {
  const { parent_id: repo, id } = content
  validateCommit(commit)

  const output = await git(Number(repo), ["rev-list", `main..${id}`])
  return output.split("\n").includes(commit)
}

// The commit a suggestion branched from: comparing the suggestion against it shows exactly what its
// contributor changed, even if the post has moved on since
async function mergeBase(content: IContent, commit: string): Promise<string> {
  const { parent_id: repo, id } = content
  validateCommit(commit)

  return (await git(Number(repo), ["merge-base", String(id), commit])).trim()
}

// A version and its ancestors along the post's own line of history (first parents), newest first:
// a merged suggestion counts as one step, through its merge commit
async function firstParentHistory(repo: number, commit: string): Promise<string[]> {
  validateCommit(commit)

  return (await git(repo, ["rev-list", "--first-parent", commit])).split("\n").filter(Boolean)
}

// Every commit a version descends from, itself included. Critiques made against any of them are
// still relevant to that version, while those made against later versions are not.
async function ancestors(repo: number, commit: string): Promise<Set<string>> {
  validateCommit(commit)

  return new Set((await git(repo, ["rev-list", commit])).split("\n").filter(Boolean))
}

async function log(content: IContent) {
  const { parent_id: repo, id } = content

  // Fields and commits are separated by NUL, the only character that can't appear in commit
  // messages or author names, since it can't be passed as a command line argument.
  const output = await git(Number(repo), ["log", "-z", "--reverse", "--format=%H%x00%s%x00%aD%x00%aN", `main..${id}`])
  const fields = output.split("\0")

  const history = []
  for (let i = 0; i + 3 < fields.length; i += 4) {
    const [commit, subject, date, author] = fields.slice(i, i + 4)
    history.push({ commit, subject, date, author })
  }

  return history
}

export default Object.freeze({
  create,
  read,
  update,
  branch,
  merge,
  mergeSides,
  isInHistory,
  mergeBase,
  firstParentHistory,
  ancestors,
  log
})
