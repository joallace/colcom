// Checks that Postgres and the git repos agree: every topic row has its repo, every post row its
// branch, every suggestion its `<postId>_<interactionId>` branch at the commit Postgres recorded,
// every critique's commit exists, and the reverse (repos and branches with no row).
//
// They can't share a transaction, so they drift when a write is interrupted between the two, or when
// a backup is restored: the git archive is taken after the database dump, so it may hold branches
// for posts and suggestions created in between. Their ids will be handed out again, and the backend
// refuses to create a branch that already exists, so `--set-aside` moves those branches (and the
// branches of repos with no topic) to refs/orphaned/<time>/<name>: nothing is deleted, git's history
// stays complete, and the names are free again. Rows without git data are only reported.
//
// Usage: node scripts/checkConsistency.mjs [--set-aside] [--fsck] [--json]
// Reads the backend's settings: POSTGRES_HOST, PGPORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
// and DB_PATH. Exits with 0 when consistent, 1 when something is reported and 2 when it can't check.
import { execFile } from "node:child_process"
import { existsSync, readdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"
import pg from "pg"


const git = (repo, args, input) => new Promise((resolvePromise, reject) => {
  const child = execFile("git", ["-C", repo, ...args], { encoding: "utf-8", maxBuffer: 256 * 1024 * 1024 },
    (err, stdout, stderr) => err ? reject(Object.assign(err, { stderr })) : resolvePromise(stdout))
  child.stdin.on("error", () => { })
  child.stdin.end(input)
})

const isRepo = path => existsSync(join(path, "HEAD")) && existsSync(join(path, "objects"))

// Branches of a repo as name → commit
async function branchesOf(repo) {
  const output = await git(repo, ["for-each-ref", "--format=%(refname:lstrip=2) %(objectname)", "refs/heads/"])
  return new Map(output.split("\n").filter(Boolean).map(line => line.split(" ")))
}

// Which of these commits the repo has
async function existingCommits(repo, commits) {
  if (!commits.length)
    return new Set()
  // `cat-file --batch-check` answers "<input> missing" or "<hash> <type> <size>", one line per input
  const output = await git(repo, ["cat-file", "--batch-check=%(objectname) %(objecttype)"], commits.join("\n") + "\n")
  const lines = output.split("\n")
  return new Set(commits.filter((commit, i) => lines[i]?.endsWith(" commit")))
}

export async function checkConsistency({ db, dbPath, setAside = false, fsck = false, now = new Date() }) {
  const problems = []
  const problem = (kind, detail, extra = {}) => problems.push({ kind, detail, ...extra })
  const setAsideRefs = []

  const { rows: contents } = await db.query(`SELECT id, type, parent_id, config FROM contents WHERE type IN ('topic', 'post', 'critique') ORDER BY id`)
  const { rows: suggestions } = await db.query(`SELECT id, content_id, config FROM interactions WHERE type = 'suggestion' ORDER BY id`)

  const topics = new Map()
  const posts = new Map()
  for (const row of contents) {
    if (row.type === "topic")
      topics.set(row.id, { id: row.id, posts: new Map(), critiqueCommits: [] })
  }
  for (const row of contents) {
    if (row.type === "post") {
      const topic = topics.get(row.parent_id)
      if (!topic) {
        problem("post-without-topic", `post ${row.id} has parent ${row.parent_id}, which is not a topic`)
        continue
      }
      const post = { id: row.id, topic: topic.id, suggestions: new Map() }
      posts.set(row.id, post)
      topic.posts.set(String(row.id), post)
    }
  }
  const critiques = []
  for (const row of contents) {
    if (row.type === "critique") {
      const post = posts.get(row.parent_id)
      if (post && row.config?.commit)
        critiques.push({ id: row.id, post: post.id, topic: post.topic, commit: row.config.commit })
    }
  }
  for (const row of suggestions) {
    const post = posts.get(row.content_id)
    if (!post) {
      problem("suggestion-without-post", `suggestion ${row.id} is on content ${row.content_id}, which is not a post`)
      continue
    }
    post.suggestions.set(`${post.id}_${row.id}`, { id: row.id, commit: row.config?.commit ?? null })
  }

  // Everything in DB_PATH but hidden files, which a file manager may leave there
  const repos = new Set(readdirSync(dbPath).filter(name => !name.startsWith(".")))
  let branchesChecked = 0

  for (const topic of topics.values()) {
    const repo = join(dbPath, String(topic.id))
    if (!repos.has(String(topic.id)) || !isRepo(repo)) {
      problem("topic-without-repo", `topic ${topic.id} has no repo at ${repo}`, { topic: topic.id })
      continue
    }

    const branches = await branchesOf(repo)
    branchesChecked += branches.size
    if (!branches.has("main"))
      problem("topic-without-main", `topic ${topic.id}'s repo has no "main" branch`, { topic: topic.id })

    for (const post of topic.posts.values()) {
      if (!branches.has(String(post.id)))
        problem("post-without-branch", `post ${post.id} has no branch in topic ${topic.id}'s repo`, { topic: topic.id, post: post.id })

      for (const [branch, suggestion] of post.suggestions) {
        if (!suggestion.commit)
          problem("suggestion-without-commit", `suggestion ${suggestion.id} on post ${post.id} has no commit recorded (its write was interrupted)`, { topic: topic.id, post: post.id, suggestion: suggestion.id })
        else if (!branches.has(branch))
          problem("suggestion-without-branch", `suggestion ${suggestion.id} on post ${post.id} has no branch "${branch}" in topic ${topic.id}'s repo`, { topic: topic.id, post: post.id, suggestion: suggestion.id })
        else if (branches.get(branch) !== suggestion.commit)
          problem("suggestion-commit-mismatch", `branch "${branch}" in topic ${topic.id}'s repo is at ${branches.get(branch)}, Postgres recorded ${suggestion.commit}`, { topic: topic.id, post: post.id, suggestion: suggestion.id })
      }
    }

    // The other way round: every branch must belong to a row
    const orphans = []
    for (const [branch, commit] of branches) {
      if (branch === "main")
        continue
      const suggestion = branch.match(/^(\d+)_(\d+)$/)
      if (/^\d+$/.test(branch)) {
        if (!topic.posts.has(branch)) {
          problem("branch-without-post", `branch "${branch}" in topic ${topic.id}'s repo has no post row`, { topic: topic.id, branch })
          orphans.push([branch, commit])
        }
      }
      else if (suggestion) {
        if (!topic.posts.get(suggestion[1])?.suggestions.has(branch)) {
          problem("branch-without-suggestion", `branch "${branch}" in topic ${topic.id}'s repo has no suggestion row`, { topic: topic.id, branch })
          orphans.push([branch, commit])
        }
      }
      else
        problem("unknown-branch", `branch "${branch}" in topic ${topic.id}'s repo isn't named like a post or a suggestion`, { topic: topic.id, branch })
    }
    if (setAside)
      setAsideRefs.push(...await setAsideBranches(repo, orphans, now))

    const topicCritiques = critiques.filter(critique => critique.topic === topic.id)
    const found = await existingCommits(repo, [...new Set(topicCritiques.map(critique => critique.commit))])
    for (const critique of topicCritiques)
      if (!found.has(critique.commit))
        problem("critique-commit-missing", `critique ${critique.id} quotes commit ${critique.commit}, which isn't in topic ${topic.id}'s repo`, { topic: topic.id, critique: critique.id })

    if (fsck)
      await git(repo, ["fsck", "--no-dangling", "--no-progress"]).catch(err =>
        problem("repo-fsck-failed", `git fsck failed in topic ${topic.id}'s repo: ${err.stderr.trim()}`, { topic: topic.id }))
  }

  // Repos with no topic row. Once all their branches are set aside they're no longer reported, and
  // the backend can create a topic with that id again (`git init` on an existing repo is harmless).
  for (const name of [...repos].sort()) {
    const path = join(dbPath, name)
    if (/^\d+$/.test(name) && topics.has(Number(name)))
      continue
    if (!isRepo(path)) {
      problem("unknown-entry", `${path} is neither a topic's repo nor expected in DB_PATH`)
      continue
    }
    const branches = await branchesOf(path)
    if (!branches.size)
      continue
    branchesChecked += branches.size
    problem("repo-without-topic", `repo ${path} has ${branches.size} branch(es) and no topic row`, { repo: name })
    if (setAside && /^\d+$/.test(name))
      setAsideRefs.push(...await setAsideBranches(path, [...branches], now))
  }

  return {
    problems,
    setAside: setAsideRefs,
    checked: { topics: topics.size, posts: posts.size, suggestions: suggestions.length, critiques: critiques.length, branches: branchesChecked }
  }
}

// Moves branches to refs/orphaned/<time>/<name>, each only if it still points where it was read
async function setAsideBranches(repo, branches, now) {
  const stamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z")
  const moved = []
  for (const [branch, commit] of branches) {
    const target = `refs/orphaned/${stamp}/${branch}`
    await git(repo, ["update-ref", target, commit, ""])
    await git(repo, ["update-ref", "-d", `refs/heads/${branch}`, commit])
    moved.push({ repo, branch, ref: target, commit })
  }
  return moved
}

async function main(argv) {
  const flags = new Set(argv)
  const unknown = [...flags].filter(flag => !["--set-aside", "--fsck", "--json"].includes(flag))
  if (unknown.length) {
    console.error(`Unknown option: ${unknown.join(" ")}\nUsage: checkConsistency.mjs [--set-aside] [--fsck] [--json]`)
    return 2
  }

  const dbPath = resolve(process.env.DB_PATH || "src/db")
  if (!existsSync(dbPath)) {
    console.error(`DB_PATH "${dbPath}" doesn't exist. Set DB_PATH to the backend's git directory.`)
    return 2
  }

  const db = new pg.Client({
    user: process.env.POSTGRES_USER,
    password: process.env.POSTGRES_PASSWORD,
    host: process.env.POSTGRES_HOST || "localhost",
    port: Number(process.env.PGPORT) || 5432,
    database: process.env.POSTGRES_DB || "colcom"
  })
  await db.connect()
  let result
  try {
    result = await checkConsistency({ db, dbPath, setAside: flags.has("--set-aside"), fsck: flags.has("--fsck") })
  }
  finally {
    await db.end()
  }

  if (flags.has("--json"))
    console.log(JSON.stringify(result, null, 2))
  else {
    const { checked, problems, setAside } = result
    console.log(`Checked ${checked.topics} topics, ${checked.posts} posts, ${checked.suggestions} suggestions, ${checked.critiques} critiques and ${checked.branches} branches in ${dbPath}`)
    for (const { kind, detail } of problems)
      console.log(`  ${kind}: ${detail}`)
    for (const { repo, branch, ref } of setAside)
      console.log(`  set aside: ${repo} ${branch} → ${ref}`)
    console.log(problems.length ? `${problems.length} problem(s) found` : "Postgres and git agree")
  }
  return result.problems.length ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href)
  main(process.argv.slice(2)).then(code => process.exit(code), err => {
    console.error(err)
    process.exit(2)
  })
