// GET /contents/:id/:hash: a post version with the critiques that apply to it, and what the client
// needs to follow critiques made on earlier versions (lineages and versions)
import { beforeAll, describe, expect, it } from "vitest"

import { api, createPost, createTopic, critique, critiqueConfig, edit, history, latestCommit, signUp, TestUser } from "../support/api"


let author: TestUser, critic: TestUser

beforeAll(async () => {
  [author, critic] = await Promise.all([signUp(), signUp()])
})

async function newPost() {
  const topic = await createTopic(author)
  return await createPost(author, topic.id)
}

const version = (postId: number, commit: string, user?: TestUser) => {
  const req = api().get(`/contents/${postId}/${commit}`)
  return user ? req.set(user.auth) : req
}

describe("GET /contents/:id/:hash", () => {
  it("returns the critiques made on that version or earlier ones, oldest first", async () => {
    const post = await newPost()
    const v1 = await latestCommit(post.id)
    const c1 = await critique(critic, post.id, critiqueConfig(v1))
    const v2 = (await edit(author, post.id, "<p>First paragraph.</p><p>Second, edited.</p>")).body.commit
    const c2 = await critique(critic, post.id, critiqueConfig(v2))
    const c3 = await critique(author, post.id, critiqueConfig(v1, "Second", { from: 20, to: 26, prefix: "First paragraph.\n", suffix: " paragraph.", start: 17 }))

    const atV1 = await version(post.id, v1)
    expect(atV1.status).toBe(200)
    expect(atV1.body.critiques.map((critique: any) => critique.id)).toEqual([c1.body.id, c3.body.id])

    const atV2 = await version(post.id, v2)
    expect(atV2.body.critiques.map((critique: any) => critique.id)).toEqual([c1.body.id, c2.body.id, c3.body.id])
    expect(atV2.body.critiques[0]).toMatchObject({ title: c1.body.title, author: critic.name, config: c1.body.config, upvotes: 0, downvotes: 0 })
  })

  it("sends the versions between each critiqued version and the one being read", async () => {
    const post = await newPost()
    const v1 = await latestCommit(post.id)
    await critique(critic, post.id, critiqueConfig(v1))
    const v2 = (await edit(author, post.id, "<p>First paragraph.</p><p>v2</p>")).body.commit
    await critique(critic, post.id, critiqueConfig(v2))
    const v3 = (await edit(author, post.id, "<p>First paragraph.</p><p>v3</p>")).body.commit

    const res = await version(post.id, v3)

    expect(res.body.lineages).toEqual({ [v1]: [v1, v2, v3], [v2]: [v2, v3] })
    // Every version the client must diff through, except the one already sent as `body`
    expect(Object.keys(res.body.versions).sort()).toEqual([v1, v2].sort())
    expect(res.body.versions[v2]).toBe("<p>First paragraph.</p>\n<p>v2</p>\n")
    expect(res.body.body).toBe("<p>First paragraph.</p>\n<p>v3</p>\n")
  })

  it("sends no lineage for critiques made on the version being read", async () => {
    const post = await newPost()
    const v1 = await latestCommit(post.id)
    await critique(critic, post.id, critiqueConfig(v1))

    const res = await version(post.id, v1)

    expect(res.body).toMatchObject({ lineages: {}, versions: {} })
    expect(res.body.base).toBeUndefined()
  })

  it("compares a critique made on a merged suggestion's own commit directly", async () => {
    const post = await newPost()
    const suggestion = (await edit(critic, post.id, "<p>First paragraph.</p><p>Suggested.</p>")).body.config.commit
    await api().post(`/contents/${post.id}/${suggestion}/merge`).set(author.auth).expect(204)
    // Once merged, the suggestion's commit is part of the post's history and can be critiqued
    const res = await critique(critic, post.id, critiqueConfig(suggestion))
    expect(res.status).toBe(201)
    const merge = await latestCommit(post.id)

    const atMerge = await version(post.id, merge)

    // It isn't on the post's first-parent line, so it's compared with the version being read
    expect(atMerge.body.lineages).toEqual({ [suggestion]: [suggestion, merge] })
  })

  it("includes the viewer's interactions with each critique", async () => {
    const post = await newPost()
    const v1 = await latestCommit(post.id)
    const { body: made } = await critique(critic, post.id, critiqueConfig(v1))
    await api().post("/interactions").set(author.auth).send({ content_id: made.id, type: "up" }).expect(201)

    const asAuthor = await version(post.id, v1, author)
    expect(asAuthor.body.critiques[0]).toMatchObject({ upvotes: 1, userInteractions: ["up"] })

    const anonymous = await version(post.id, v1)
    expect(anonymous.body.critiques[0]).not.toHaveProperty("userInteractions")
  })

  it("only answers for posts", async () => {
    const topic = await createTopic(author)
    const post = await createPost(author, topic.id)

    const res = await version(topic.id, await latestCommit(post.id))

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Conteúdos do tipo "topic" não têm histórico.')
    expect((await version(999999, "abcdef1")).status).toBe(404)
  })

  it.each(["HEAD", "main", "--all", "abc", "g".repeat(40)])("refuses %s as a hash", async hash => {
    const post = await newPost()
    const res = await version(post.id, hash)

    expect(res.status).toBe(400)
    expect(res.body.key).toBe("hash")
  })

  it("answers with a generic error for a well formed hash that doesn't exist", async () => {
    const post = await newPost()
    const res = await version(post.id, "0".repeat(40))

    expect(res.status).toBe(500)
    expect(res.body).toEqual({
      name: "InternalServerError",
      message: "Um erro interno não esperado aconteceu.",
      action: "Informe ao suporte o valor encontrado no campo 'error_id'.",
      statusCode: 500,
      errorId: expect.any(String)
    })
  })

  it("keeps history in the order of the post's timeline", async () => {
    const post = await newPost()
    for (const i of [1, 2, 3])
      await edit(author, post.id, `<p>Version ${i}</p>`, `v${i}`)

    expect((await history(post.id)).map(entry => entry.subject)).toEqual([`init post ${post.id}`, "v1", "v2", "v3"])
  })
})
