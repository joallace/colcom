import { execFileSync } from "node:child_process"
import { existsSync, rmSync } from "node:fs"
import { join } from "node:path"
import { beforeAll, describe, expect, it } from "vitest"

import { api, createPost, createTopic, critique, critiqueConfig, edit, history, interact, latestCommit, signUp, TestUser, unique } from "../support/api"


let alice: TestUser, bob: TestUser

beforeAll(async () => {
  [alice, bob] = await Promise.all([signUp(), signUp()])
})

const repo = (topicId: number) => join(process.env.DB_PATH!, String(topicId))
const git = (topicId: number, ...args: string[]) => execFileSync("git", ["-C", repo(topicId), ...args], { encoding: "utf-8" })

describe("creating a topic", () => {
  it("stores it and creates its git repository", async () => {
    const topic = await createTopic(alice, { body: "<p>Should we?</p><p>Discuss.</p>", answers: ["sim", "não", "talvez"] })

    expect(topic).toMatchObject({ type: "topic", author: alice.name, author_id: alice.pid, parent_id: null, config: { answers: ["sim", "não", "talvez"] } })
    // Only posts are summarized; a topic keeps its whole text
    expect(topic.body).toBe("<p>Should we?</p><p>Discuss.</p>")
    // A bare repo, written without a working tree
    expect(git(topic.id, "rev-parse", "--is-bare-repository").trim()).toBe("true")
    // One block per line, so git can diff and merge paragraphs separately
    expect(git(topic.id, "show", "main:main.html")).toBe("<p>Should we?</p>\n<p>Discuss.</p>\n")
  })

  it("requires a title", async () => {
    const res = await api().post("/contents").set(alice.auth).send({ body: "<p>x</p>" })
    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ key: "title", message: "Título: campo obrigatório." })
  })

  it("requires the user to be logged in", async () => {
    const res = await api().post("/contents").send({ title: unique("Anonymous") })
    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Token de autorização não fornecido.")
  })

  it("refuses a title already in use, ignoring case, across content types", async () => {
    const topic = await createTopic(alice)
    const post = await createPost(alice, topic.id)

    for (const title of [topic.title.toUpperCase(), post.title.toLowerCase()]) {
      const res = await api().post("/contents").set(bob.auth).send({ title })
      expect(res.status).toBe(400)
      expect(res.body).toMatchObject({ key: "title", message: 'O "title" informado já está sendo usado.' })
    }
  })
})

describe("creating a post", () => {
  it("stores a summary in Postgres and the whole text in its own branch", async () => {
    const topic = await createTopic(alice)
    const body = "<h2>Intro</h2><p></p><p>The <strong>first</strong> real paragraph.</p><p>More.</p>"
    const post = await createPost(bob, topic.id, { body, answer: "não" })

    expect(post).toMatchObject({ type: "post", parent_id: topic.id, author: bob.name, author_id: bob.pid, config: { answer: "não" } })
    expect(post.body).toBe(body)

    const stored = await api().get(`/contents/${post.id}`)
    expect(stored.status).toBe(200)
    expect(stored.body.body).toBe("The <strong>first</strong> real paragraph.")
    expect(stored.body.history).toEqual([
      { commit: expect.stringMatching(/^[0-9a-f]{40}$/), subject: `init post ${post.id}`, date: expect.any(String), author: bob.name }
    ])

    const version = await api().get(`/contents/${post.id}/${stored.body.history[0].commit}`)
    expect(version.body.body).toBe("<h2>Intro</h2>\n<p></p>\n<p>The <strong>first</strong> real paragraph.</p>\n<p>More.</p>\n")
  })

  it("gets its own first commit even when its text equals the topic's", async () => {
    const topic = await createTopic(alice, { body: "<p>Same text</p>" })
    const post = await createPost(alice, topic.id, { body: "<p>Same text</p>" })

    expect(await history(post.id)).toHaveLength(1)
  })

  it("requires a body", async () => {
    const topic = await createTopic(alice)
    const res = await api().post("/contents").set(alice.auth).send({ title: unique("Empty"), parent_id: topic.id, body: "" })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ key: "body", message: "Texto: campo obrigatório." })
  })

  it("answers 404 for a parent that doesn't exist", async () => {
    const res = await api().post("/contents").set(alice.auth).send({ title: unique("Orphan"), parent_id: 999999, body: "<p>x</p>" })
    expect(res.status).toBe(404)
  })

  it("keeps posts created at the same time on separate branches", async () => {
    const topic = await createTopic(alice)
    const posts = await Promise.all(Array.from({ length: 5 }, (_, i) => createPost(i % 2 ? alice : bob, topic.id, { body: `<p>Post number ${i}</p>` })))

    for (const [i, post] of posts.entries()) {
      const [first] = await history(post.id)
      const version = await api().get(`/contents/${post.id}/${first.commit}`)
      expect(version.body.body).toBe(`<p>Post number ${i}</p>\n`)
    }
  })

  it("removes the row when the git write fails, leaving its title free", async () => {
    const topic = await createTopic(alice)
    rmSync(repo(topic.id), { recursive: true })
    const title = unique("Doomed")

    const failed = await api().post("/contents").set(alice.auth).send({ title, parent_id: topic.id, body: "<p>x</p>", config: { answer: "sim" } })
    expect(failed.status).toBe(500)

    const profile = await api().get("/contents").query({ authorId: alice.pid, pageSize: 100 })
    expect(profile.body.contents.map((content: any) => content.title)).not.toContain(title)
    expect(existsSync(repo(topic.id))).toBe(false)

    const retried = await api().post("/contents").set(alice.auth).send({ title })
    expect(retried.status).toBe(201)
  })
})

describe("a post's answer", () => {
  it("must be one of the topic's answers", async () => {
    const topic = await createTopic(alice, { answers: ["sim", "não"] })
    const res = await api().post("/contents").set(alice.auth).send({ title: unique("Maybe"), parent_id: topic.id, body: "<p>x</p>", config: { answer: "talvez" } })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ key: "config.answer", message: "Resposta: escolha uma das respostas do tópico." })
  })

  it("is free when the topic leaves answers open", async () => {
    const topic = await createTopic(alice, { answers: [] })
    await createPost(alice, topic.id, { answer: "" })
  })
})

describe("request validation", () => {
  it("refuses a topic with a single answer", async () => {
    const res = await api().post("/contents").set(alice.auth).send({ title: unique("Lonely"), config: { answers: ["sim"] } })
    expect(res.status).toBe(400)
    expect(res.body.key).toBe("config.answers")
  })

  it("refuses ids that aren't positive integers", async () => {
    for (const id of ["abc", "0", "1.5", "99999999999"]) {
      const res = await api().get(`/contents/${id}`)
      expect(res.status, id).toBe(400)
      expect(res.body.key).toBe("id")
    }
  })

  it("answers 404 when cloning a post that doesn't exist", async () => {
    const res = await api().post("/contents/999999/abc1234/clone").set(alice.auth).send({ title: unique("Clone") })
    expect(res.status).toBe(404)
  })
})

describe("creating a critique", () => {
  it("anchors it to a version of the post, dropping unknown keys", async () => {
    const topic = await createTopic(alice)
    const post = await createPost(alice, topic.id)
    const commit = await latestCommit(post.id)
    const config = { ...critiqueConfig(commit), extra: "dropped", quote: { ...critiqueConfig(commit).quote, evil: true } }

    const res = await critique(bob, post.id, config)

    expect(res.status).toBe(201)
    expect(res.body).toMatchObject({ type: "critique", parent_id: post.id, author_id: bob.pid })
    expect(res.body.config).toEqual(critiqueConfig(commit))
    // Critiques aren't versioned: no branch, no history
    const stored = await api().get(`/contents/${res.body.id}`)
    expect(stored.body.history).toBeUndefined()
    expect(stored.body.body).toBe("<p>I disagree.</p>")
  })

  it.each([
    ["no config", undefined],
    ["a reversed range", { from: 6, to: 1 }],
    ["a negative offset", { from: -1 }],
    ["a fractional offset", { to: 2.5 }],
    ["a blank quote", { quote: { exact: "   ", prefix: "", suffix: "", start: 0 } }],
    ["a quote without context", { quote: { exact: "First", start: 0 } }],
    ["too long a prefix", { quote: { exact: "First", prefix: "x".repeat(33), suffix: "", start: 0 } }],
    ["too long a quote", { quote: { exact: "x".repeat(5001), prefix: "", suffix: "", start: 0 } }],
    ["a commit that isn't a string", { commit: 123 }],
  ])("refuses %s", async (_, override) => {
    const topic = await createTopic(alice)
    const post = await createPost(alice, topic.id)
    const config = override && { ...critiqueConfig(await latestCommit(post.id)), ...override }

    const res = await critique(bob, post.id, config as object)

    expect(res.status).toBe(400)
    expect(res.body.key).toMatch(/^config(\.|$)/)
    expect(res.body.action).toBe("Selecione um trecho de texto do post e tente novamente.")
  })

  it("refuses a version that isn't in the post's own history", async () => {
    const topic = await createTopic(alice)
    const [post, other] = [await createPost(alice, topic.id), await createPost(bob, topic.id)]

    const res = await critique(bob, post.id, critiqueConfig(await latestCommit(other.id)))

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ key: "config.commit", errorLocationCode: "CONTROLLER:CONTENT:VALIDATE_CRITIQUE_COMMIT:FOREIGN_COMMIT" })
  })

  it("refuses a hash that git would read as an option", async () => {
    const topic = await createTopic(alice)
    const post = await createPost(alice, topic.id)

    const res = await critique(bob, post.id, critiqueConfig("--output=/tmp/pwned"))

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ key: "config.commit", message: "Versão criticada: versão inválida." })
  })

  it("refuses critiques of critiques", async () => {
    const topic = await createTopic(alice)
    const post = await createPost(alice, topic.id)
    const first = await critique(bob, post.id, critiqueConfig(await latestCommit(post.id)))

    const res = await critique(alice, first.body.id, critiqueConfig(await latestCommit(post.id)))

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Somente posts podem ser criticados.")
  })
})

describe("GET /contents/:id", () => {
  it("answers 404 for an unknown id", async () => {
    const res = await api().get("/contents/999999")
    expect(res.status).toBe(404)
  })

  it("includes the viewer's interactions only for a logged in viewer", async () => {
    const topic = await createTopic(alice)
    await api().post("/interactions").set(bob.auth).send({ content_id: topic.id, type: "bookmark" })

    expect((await api().get(`/contents/${topic.id}`)).body.userInteractions).toBeUndefined()
    expect((await api().get(`/contents/${topic.id}`).set(bob.auth)).body.userInteractions).toEqual(["bookmark"])
    expect((await api().get(`/contents/${topic.id}`).set(alice.auth)).body.userInteractions).toEqual([])
  })

  it("can omit the body and include the parent's title", async () => {
    const topic = await createTopic(alice)
    const post = await createPost(alice, topic.id)

    const res = await api().get(`/contents/${post.id}`).query("omit_body&include_parent_title")

    expect(res.body).not.toHaveProperty("body")
    expect(res.body.parent_title).toBe(topic.title)
  })

  it("has no history for topics", async () => {
    const topic = await createTopic(alice)
    const res = await api().get(`/contents/${topic.id}`)

    expect(res.body.history).toBeUndefined()
    expect(res.body.suggestions).toBeUndefined()
    expect(res.body.interactionCounts).toBeUndefined()
  })

  it("counts a post's poll votes, suggestions and critiques, whatever their state", async () => {
    const topic = await createTopic(alice)
    const post = await createPost(alice, topic.id)
    const commit = await latestCommit(post.id)
    const carol = await signUp()

    expect((await api().get(`/contents/${post.id}`)).body.interactionCounts).toEqual({ votes: 0, suggestions: 0, critiques: 0 })

    await interact(bob, post.id, "vote")
    await interact(bob, post.id, "up")
    await critique(bob, post.id, critiqueConfig(commit))
    await critique(carol, post.id, critiqueConfig(commit))
    const pending = await edit(bob, post.id, "<p>First paragraph.</p><p>Changed by bob.</p>")
    await edit(carol, post.id, "<p>Changed by carol.</p><p>Second paragraph.</p>")
    expect((await api().post(`/contents/${post.id}/${pending.body.config.commit}/reject`).set(alice.auth)).status).toBe(200)

    const res = await api().get(`/contents/${post.id}`)
    expect(res.body.interactionCounts).toEqual({ votes: 1, suggestions: 2, critiques: 2 })
    expect(res.body).toMatchObject({ upvotes: 1, downvotes: 0 })
  })
})
