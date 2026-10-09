// scripts/checkConsistency.mjs: Postgres rows against git repos and branches. It reads every row,
// so it has a file (and a database) of its own.
import { execFile, execFileSync } from "node:child_process"
import { mkdirSync } from "node:fs"
import { join, resolve } from "node:path"
import { beforeAll, describe, expect, it } from "vitest"

// @ts-expect-error The script is plain JavaScript, outside the build
import { checkConsistency } from "../../scripts/checkConsistency.mjs"
import db from "@/pgDatabase"
import { api, createPost, createTopic, critique, critiqueConfig, edit, latestCommit, signUp, TestUser, unique } from "../support/api"


const dbPath = () => process.env.DB_PATH!
const gitIn = (repo: string | number, args: string[]) =>
  execFileSync("git", ["-C", join(dbPath(), String(repo)), ...args], { encoding: "utf-8" }).trim()

const check = (options = {}) => checkConsistency({ db, dbPath: dbPath(), ...options })
const kinds = (problems: { kind: string }[]) => problems.map(problem => problem.kind).sort()

let author: TestUser, contributor: TestUser
let topic: { id: number }, post: { id: number }, pending: { id: number, config: { commit: string } }

beforeAll(async () => {
  [author, contributor] = await Promise.all([signUp(), signUp()])

  // One of everything that lives in git: a topic, posts, an edit, a clone, critiques and suggestions
  // accepted, rejected and pending
  topic = await createTopic(author)
  post = await createPost(author, topic.id)
  expect((await edit(author, post.id, "<p>First paragraph, edited.</p>")).status).toBe(200)

  const accepted = await edit(contributor, post.id, "<p>First paragraph, suggested.</p>")
  expect((await api().post(`/contents/${post.id}/${accepted.body.config.commit}/merge`).set(author.auth)).status).toBe(204)
  const rejected = await edit(contributor, post.id, "<p>First paragraph, rejected.</p>")
  expect((await api().post(`/contents/${post.id}/${rejected.body.config.commit}/reject`).set(author.auth)).status).toBeLessThan(300)
  pending = (await edit(contributor, post.id, "<p>First paragraph, pending.</p>")).body

  const clone = await api().post(`/contents/${post.id}/${await latestCommit(post.id)}/clone`).set(contributor.auth).send({ title: unique("Clone") })
  expect(clone.status, JSON.stringify(clone.body)).toBe(200)
  expect((await critique(contributor, post.id, critiqueConfig(await latestCommit(post.id)))).status).toBe(201)

  await createPost(contributor, (await createTopic(contributor)).id)
})

describe("checkConsistency", () => {
  it("finds nothing wrong in what the API wrote", async () => {
    const result = await check()

    expect(result.problems).toEqual([])
    expect(result.checked).toMatchObject({ topics: 2, posts: 3, suggestions: 3, critiques: 1 })
    // main twice, three posts and three suggestions
    expect(result.checked.branches).toBe(8)
  })

  describe("after the two sides drift apart", () => {
    let missingTopic: number, orphanCommit: string

    beforeAll(async () => {
      const { rows: [user] } = await db.query("SELECT id FROM users WHERE pid = $1", [author.pid])

      // Rows whose git data is missing: a topic, a post's branch, a suggestion's and a critique's commit
      missingTopic = (await db.query("INSERT INTO contents (title, author_id, type) VALUES ('Lost topic', $1, 'topic') RETURNING id", [user.id])).rows[0].id
      const lostPost = await createPost(author, topic.id)
      gitIn(topic.id, ["update-ref", "-d", `refs/heads/${lostPost.id}`])
      await db.query("UPDATE interactions SET config = jsonb_set(config, '{commit}', to_jsonb($1::TEXT)) WHERE id = $2", ["0".repeat(40), pending.id])
      await db.query("UPDATE contents SET config = jsonb_set(config, '{commit}', to_jsonb($1::TEXT)) WHERE type = 'critique'", ["f".repeat(40)])

      // Git data with no rows, as when a backup's git archive is newer than its dump: a post's
      // branch, a suggestion's and a whole topic's repo
      orphanCommit = gitIn(topic.id, ["rev-parse", `refs/heads/${post.id}`])
      gitIn(topic.id, ["update-ref", "refs/heads/999999", orphanCommit])
      gitIn(topic.id, ["update-ref", `refs/heads/${post.id}_999999`, orphanCommit])
      gitIn(topic.id, ["update-ref", "refs/heads/feature", orphanCommit])
      execFileSync("git", ["clone", "--quiet", "--bare", join(dbPath(), String(topic.id)), join(dbPath(), "888888")])
      mkdirSync(join(dbPath(), "notes"))
    })

    it("reports every row without git data and every branch or repo without a row", async () => {
      const { problems } = await check()

      expect(kinds(problems)).toEqual([
        "branch-without-post",
        "branch-without-suggestion",
        "critique-commit-missing",
        "post-without-branch",
        "repo-without-topic",
        "suggestion-commit-mismatch",
        "topic-without-repo",
        "unknown-branch",
        "unknown-entry"
      ])
      expect(problems.find((problem: { kind: string }) => problem.kind === "topic-without-repo").topic).toBe(missingTopic)
    })

    it("sets orphaned branches aside, without deleting anything, and stops reporting them", async () => {
      const { setAside } = await check({ setAside: true, now: new Date("2026-01-02T03:04:05Z") })

      const fromTopic = setAside.filter((moved: { repo: string }) => moved.repo.endsWith(`/${topic.id}`))
      expect(fromTopic.map((moved: { branch: string }) => moved.branch).sort()).toEqual([`${post.id}_999999`, "999999"])
      // Every branch of the repo with no topic, "main" included
      expect(setAside.filter((moved: { repo: string }) => moved.repo.endsWith("/888888")).map((moved: { branch: string }) => moved.branch)).toContain("main")
      expect(gitIn(topic.id, ["rev-parse", "refs/orphaned/20260102T030405Z/999999"])).toBe(orphanCommit)
      expect(gitIn(888888, ["for-each-ref", "refs/heads/"])).toBe("")

      const { problems } = await check()
      expect(kinds(problems)).toEqual([
        "critique-commit-missing",
        "post-without-branch",
        "suggestion-commit-mismatch",
        "topic-without-repo",
        "unknown-branch",
        "unknown-entry"
      ])
    })

    it("lets the backend reuse a set-aside branch's name", async () => {
      // The next post gets an id whose branch may have been set aside; here, force it
      const { rows: [{ next }] } = await db.query("SELECT last_value + 1 AS next FROM contents_id_seq")
      gitIn(topic.id, ["update-ref", `refs/heads/${next}`, orphanCommit])
      await check({ setAside: true })

      const created = await createPost(author, topic.id)
      expect(created.id).toBe(Number(next))
    })
  })

  it("runs from the command line, exiting with 1 when something is wrong", async () => {
    const run = (args: string[]) => new Promise<{ code: number, stdout: string }>(done =>
      execFile("node", [resolve(import.meta.dirname, "../../scripts/checkConsistency.mjs"), ...args], { encoding: "utf-8" },
        (err, stdout) => done({ code: err ? Number(err.code) : 0, stdout })))

    const { code, stdout } = await run(["--json"])
    expect(code).toBe(1)
    expect(kinds(JSON.parse(stdout).problems)).toContain("topic-without-repo")

    const text = await run([])
    expect(text.stdout).toMatch(/topic-without-repo: topic \d+ has no repo/)
    expect(text.stdout).toMatch(/\d+ problem\(s\) found/)

    expect((await run(["--bogus"])).code).toBe(2)
  })
})
