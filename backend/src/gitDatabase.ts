import { dirname, resolve } from "path"
import { fileURLToPath } from "url"
import { existsSync, mkdirSync } from "fs"
import { writeFile, mkdir } from "fs/promises"
import { promisify } from "util"
import { execFile } from "node:child_process"
import AsyncLock from "async-lock"

import { IContent } from "@/models/content"
import logger from "@/logger"
import { ValidationError } from "./errors"

const exec = promisify(execFile)

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DB_PATH || resolve(__dirname, "db/")

if (!existsSync(dbPath)) {
  logger.info(`[gitDatabase.ts] Creating git db at "${dbPath}"`)
  mkdirSync(dbPath)
}
else
  logger.info(`[gitDatabase.ts] Loaded git db at "${dbPath}"`)

// Every write checks out a branch in the repo's shared working tree, so all operations
// on the same repo must be serialized through this single, module wide lock.
const lock = new AsyncLock()

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

// Runs a write while holding the repo's lock. If it fails midway, the working tree is reset,
// otherwise leftover changes would make every later checkout in this repo fail.
async function write<T>(repo: number, operation: () => Promise<T>): Promise<T> {
  return await lock.acquire(String(repo), async () => {
    try {
      return await operation()
    }
    catch (err) {
      await exec("git", ["-C", `${dbPath}/${repo}`, "reset", "--hard", "--quiet"]).catch(() => { })
      throw err
    }
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

async function create(content: IContent, author: any) {
  const { parent_id, id, type, body } = content

  if (type === "critique")
    return

  const repo = parent_id || id
  const path = `${dbPath}/${repo}`
  const file = `${path}/main.html`

  await write(repo, async () => {
    if (type === "topic") {
      await mkdir(path)
      await exec("git", ["-C", path, "init", "-b", "main"])
    }
    else
      await exec("git", ["-C", path, "checkout", "-b", String(id), "main"])

    await writeFile(file, formatHtml(body || ""))
    await exec("git", ["-C", path, "add", file])
    // A post identical to the topic's text would otherwise have nothing to commit, and every post
    // needs its own first commit to appear in its history.
    await exec("git", ["-C", path, "commit", "--allow-empty", "-m", type === "topic" ? "init topic" : `init post ${id}`, "--author", `${author.username} <${author.email}>`])
  })
}

async function read(repo: number, commit: string) {
  validateCommit(commit)
  const path = `${dbPath}/${repo}`

  const output = await exec("git", ["-C", path, "show", `${commit}:./main.html`])
  return (output.stdout ?? output)
}

async function update(content: IContent, author: any, body: string, message: string, interactionId: number | undefined) {
  const { parent_id: repo, id } = content
  const path = `${dbPath}/${repo}`
  const file = `${path}/main.html`

  return await write(Number(repo), async () => {
    if (interactionId === undefined)
      await exec("git", ["-C", path, "checkout", String(id)])
    else
      await exec("git", ["-C", path, "checkout", "-b", `${id}_${interactionId}`, String(id)])

    await writeFile(file, formatHtml(body))
    await exec("git", ["-C", path, "add", file])

    const hasChanges = await exec("git", ["-C", path, "diff", "--cached", "--quiet"]).then(() => false, () => true)
    if (!hasChanges)
      throw new ValidationError({
        message: "Nenhuma alteração foi feita no texto.",
        action: "Altere o conteúdo antes de enviar a edição.",
        stack: new Error().stack,
        errorLocationCode: "GIT:UPDATE:NO_CHANGES"
      })

    await exec("git", ["-C", path, "commit", "-m", message, "--author", `${author.username} <${author.email}>`])

    const output = await exec("git", ["-C", path, "rev-parse", "HEAD"])
    return (<any>(output.stdout ?? output)).trimEnd()
  })
}

async function branch(content: IContent, commit: string) {
  const { parent_id: repo, id } = content
  const path = `${dbPath}/${repo}`

  validateCommit(commit)

  await write(Number(repo), async () => {
    await exec("git", ["-C", path, "checkout", "-b", String(id), commit])
  })
}

async function merge(content: IContent, commit: string) {
  const { parent_id: repo, id } = content
  const path = `${dbPath}/${repo}`

  validateCommit(commit)

  await write(Number(repo), async () => {
    await exec("git", ["-C", path, "checkout", String(id)])
    try {
      await exec("git", ["-C", path, "merge", "--no-ff", commit])
    } catch (err) {
      await exec("git", ["-C", path, "merge", "--abort"])
      throw new ValidationError({
        message: "Conflito no merge!"
      })
    }
  })
}

// Whether a commit is part of a post's own history, i.e. a version readers can see on its timeline.
// The topic's commits on main are ancestors of every post, but belong to none of them.
async function isInHistory(content: IContent, commit: string): Promise<boolean> {
  const { parent_id: repo, id } = content
  validateCommit(commit)

  const output = await exec("git", ["-C", `${dbPath}/${repo}`, "rev-list", `main..${id}`], { encoding: "utf-8" })
  return String(output?.stdout ?? output).split("\n").includes(commit)
}

// The commit a suggestion branched from: comparing the suggestion against it shows exactly what its
// contributor changed, even if the post has moved on since
async function mergeBase(content: IContent, commit: string): Promise<string> {
  const { parent_id: repo, id } = content
  validateCommit(commit)

  const output = await exec("git", ["-C", `${dbPath}/${repo}`, "merge-base", String(id), commit], { encoding: "utf-8" })
  return String(output?.stdout ?? output).trim()
}

// Every commit a version descends from, itself included. Critiques made against any of them are
// still relevant to that version, while those made against later versions are not.
async function ancestors(repo: number, commit: string): Promise<Set<string>> {
  validateCommit(commit)

  const output = await exec("git", ["-C", `${dbPath}/${repo}`, "rev-list", commit], { encoding: "utf-8" })
  return new Set(String(output?.stdout ?? output).split("\n").filter(Boolean))
}

async function log(content: IContent) {
  const { parent_id: repo, id } = content
  const path = `${dbPath}/${repo}/`

  // Fields and commits are separated by NUL, the only character that can't appear in commit
  // messages or author names, since it can't be passed as a command line argument.
  const output = await exec("git", ["-C", path, "log", "-z", "--reverse", "--format=%H%x00%s%x00%aD%x00%aN", `main..${id}`], { encoding: "utf-8" })
  const fields = String(output?.stdout ?? output).split("\0")

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
  isInHistory,
  mergeBase,
  ancestors,
  log
})