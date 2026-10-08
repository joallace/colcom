// Checks, once the load is over, that the data survived it: the repos are sound, no acknowledged
// write was lost, no write landed that was reported as failed, and Postgres agrees with git.
import { execFile } from "node:child_process"
import { readdir } from "node:fs/promises"
import { join } from "node:path"

// The same summary the backend keeps in Postgres (models/content.ts), to compare with git's text
export function summarize(html) {
  const paragraph = [...html.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g)].map(match => match[1].trim()).find(text => text.length > 0)
  return (paragraph ?? html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()).slice(0, 280)
}

const git = (repo, args) => new Promise((resolve, reject) =>
  execFile("git", ["-C", repo, ...args], { encoding: "utf-8", maxBuffer: 64 * 1024 * 1024, env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" } },
    (err, stdout, stderr) => err ? reject(Object.assign(err, { stderr })) : resolve(stdout)))

const succeeds = promise => promise.then(() => true, () => false)

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name)
    if (entry.isDirectory())
      yield* walk(path)
    else
      yield path
  }
}

export async function checkIntegrity({ must }, ledger, dbPath) {
  const problems = []
  const problem = (kind, detail) => problems.push({ kind, detail })
  const result = { problems }

  // Postgres: every acknowledged post's summary must be its branch tip's first paragraph. Two edits
  // racing in git and then in Postgres can land in a different order in each.
  let compared = 0
  for (const [postId, { topicId }] of ledger.posts) {
    const content = await must("GET", `/contents/${postId}`)
    const tip = content.history.at(-1).commit
    const { body } = await must("GET", `/contents/${postId}/${tip}`)
    compared++
    // Accepting a suggestion doesn't update the summary (mergePost), a known bug apart from any race
    if (summarize(body) !== content.body)
      problem(content.history.at(-1).subject.startsWith("Merge commit") ? "summary-stale-after-merge" : "postgres-git-mismatch", `post ${postId} (topic ${topicId}): Postgres has "${content.body.slice(0, 40)}…", git's tip ${tip.slice(0, 8)} has "${summarize(body).slice(0, 40)}…"`)
  }
  result.postsCompared = compared

  if (!dbPath) {
    result.git = "skipped: no --db-path"
    return result
  }

  // Every content row of the topics written to must have its branch, and every branch its row
  const topics = new Set([...ledger.posts.values()].map(post => post.topicId).concat(ledger.createdPosts.map(post => post.topicId)))
  let branchesChecked = 0
  for (const topicId of topics) {
    const repo = join(dbPath, String(topicId))
    const { children } = await must("GET", `/topics/${topicId}`)
    const rows = new Set(children.map(post => String(post.id)))
    const branches = new Set((await git(repo, ["for-each-ref", "--format=%(refname:short)", "refs/heads/"])).split("\n").filter(name => /^\d+$/.test(name)))
    branchesChecked += branches.size
    for (const id of rows)
      if (!branches.has(id))
        problem("row-without-branch", `post ${id} in topic ${topicId}`)
    for (const id of branches)
      if (!rows.has(id))
        problem("branch-without-row", `branch ${id} in topic ${topicId}`)
  }
  result.branchesChecked = branchesChecked

  // Each acknowledged edit or accepted suggestion is one commit on its post's first-parent line,
  // after the post's first commit: fewer means lost writes, more means phantom ones
  let commitsChecked = 0
  for (const [postId, { topicId, commits }] of ledger.posts) {
    const repo = join(dbPath, String(topicId))
    const line = new Set((await git(repo, ["rev-list", "--first-parent", `main..refs/heads/${postId}`])).split("\n").filter(Boolean))
    const reachable = new Set((await git(repo, ["rev-list", `refs/heads/${postId}`])).split("\n").filter(Boolean))
    for (const commit of commits) {
      commitsChecked++
      if (!reachable.has(commit))
        problem("lost-write", `post ${postId}: acknowledged commit ${commit.slice(0, 8)} isn't in its branch`)
    }
    // The fixture's first commit is in the ledger too; accepted suggestions add a merge commit each
    if (line.size !== commits.length)
      problem(line.size > commits.length ? "phantom-write" : "lost-write", `post ${postId}: ${line.size} commits on its line, ${commits.length} acknowledged`)
  }
  result.commitsChecked = commitsChecked

  for (const { topicId, postId, interactionId, commit } of ledger.suggestions) {
    const branch = `${postId}_${interactionId}`
    const at = (await git(join(dbPath, String(topicId)), ["rev-parse", "--verify", "--quiet", `refs/heads/${branch}`]).catch(() => "")).trim()
    if (at !== commit)
      problem("lost-suggestion", `branch ${branch} is at "${at.slice(0, 8)}", the suggestion was ${commit.slice(0, 8)}`)
  }
  result.suggestionsChecked = ledger.suggestions.length

  for (const { topicId, id } of ledger.createdPosts)
    if (!(await succeeds(git(join(dbPath, String(topicId)), ["rev-parse", "--verify", "--quiet", `refs/heads/${id}`]))))
      problem("lost-post", `post ${id} in topic ${topicId} has no branch`)
  result.createdPostsChecked = ledger.createdPosts.length

  // Every repo: objects sound, no lock files left behind, and a working tree (before bare repos) clean
  const repos = (await readdir(dbPath, { withFileTypes: true })).filter(entry => entry.isDirectory()).map(entry => join(dbPath, entry.name))
  for (const repo of repos) {
    await git(repo, ["fsck", "--no-progress", "--no-dangling"]).catch(err => problem("fsck", `${repo}: ${err.stderr.trim().split("\n")[0]}`))
    for await (const path of walk(repo))
      if (path.endsWith(".lock"))
        problem("stale-lock", path)
    if ((await git(repo, ["rev-parse", "--is-bare-repository"])).trim() === "false") {
      const status = (await git(repo, ["status", "--porcelain"])).trim()
      if (status)
        problem("dirty-working-tree", `${repo}: ${status.split("\n").length} changed files`)
    }
  }
  result.reposChecked = repos.length

  return result
}
