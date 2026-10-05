// Editing posts, suggestions (edits by someone other than the author), merging and cloning
import { beforeAll, describe, expect, it } from "vitest"

import { api, createPost, createTopic, edit, history, latestCommit, signUp, TestUser } from "../support/api"


let author: TestUser, contributor: TestUser

beforeAll(async () => {
  [author, contributor] = await Promise.all([signUp(), signUp()])
})

const THREE_PARAGRAPHS = "<p>Alpha paragraph.</p><p>Beta paragraph.</p><p>Gamma paragraph.</p>"

async function newPost(body = THREE_PARAGRAPHS) {
  const topic = await createTopic(author)
  return await createPost(author, topic.id, { body })
}

const read = async (postId: number, commit: string) => (await api().get(`/contents/${postId}/${commit}`)).body.body

const pendingSuggestions = async (postId: number) => (await api().get(`/contents/${postId}`).set(author.auth)).body.suggestions

describe("the author editing a post", () => {
  it("commits a new version and updates the summary", async () => {
    const post = await newPost()
    const res = await edit(author, post.id, "<p>Rewritten intro.</p><p>Beta paragraph.</p>", "Rewrites the intro")

    expect(res.status).toBe(200)
    expect(res.body.commit).toMatch(/^[0-9a-f]{40}$/)
    expect(res.body.body).toBe("Rewritten intro.")

    const versions = await history(post.id)
    expect(versions.map(version => version.subject)).toEqual([`init post ${post.id}`, "Rewrites the intro"])
    expect(versions.at(-1)!.commit).toBe(res.body.commit)
    expect(await read(post.id, res.body.commit)).toBe("<p>Rewritten intro.</p>\n<p>Beta paragraph.</p>\n")
    // The old version is still there
    expect(await read(post.id, versions[0].commit)).toBe("<p>Alpha paragraph.</p>\n<p>Beta paragraph.</p>\n<p>Gamma paragraph.</p>\n")
  })

  it("refuses an edit that changes nothing, and the repository stays usable", async () => {
    const post = await newPost()

    const res = await edit(author, post.id, THREE_PARAGRAPHS)
    expect(res.status).toBe(400)
    expect(res.body.errorLocationCode).toBe("GIT:UPDATE:NO_CHANGES")
    expect(await history(post.id)).toHaveLength(1)

    expect((await edit(author, post.id, "<p>Changed.</p>")).status).toBe(200)
  })

  it.each([
    ["message", { body: "<p>x</p>" }],
    ["message", { body: "<p>x</p>", message: "   " }],
    ["body", { message: "x" }],
  ])("requires %s", async (key, payload) => {
    const post = await newPost()
    const res = await api().patch(`/contents/${post.id}`).set(author.auth).send(payload)

    expect(res.status).toBe(400)
    expect(res.body.key).toBe(key)
  })

  it("keeps commit messages intact, whatever characters they hold", async () => {
    const post = await newPost()
    const message = 'Quotes "double" \'single\', émojis 🎉, a | pipe and %x00 escapes'

    await edit(author, post.id, "<p>v2</p>", message)

    expect((await history(post.id)).at(-1)!.subject).toBe(message)
  })

  it("serializes concurrent edits to the same repository", async () => {
    const post = await newPost()
    const results = await Promise.all(Array.from({ length: 6 }, (_, i) => edit(author, post.id, `<p>Version ${i}</p>`, `edit ${i}`)))

    expect(results.map(res => res.status)).toEqual(Array(6).fill(200))
    expect(await history(post.id)).toHaveLength(7)
  })

  it("only edits posts", async () => {
    const topic = await createTopic(author)
    const res = await edit(author, topic.id, "<p>x</p>")

    expect(res.status).toBe(400)
    expect(res.body.message).toBe('Conteúdos do tipo "topic" não podem ser alterados.')
  })

  it("answers 404 for an unknown post", async () => {
    expect((await edit(author, 999999, "<p>x</p>")).status).toBe(404)
  })
})

describe("suggestions", () => {
  it("are created when someone else edits a post, without changing it", async () => {
    const post = await newPost()
    const res = await edit(contributor, post.id, "<p>Alpha paragraph, improved.</p><p>Beta paragraph.</p><p>Gamma paragraph.</p>", "Improves alpha")

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ type: "suggestion", content_id: post.id, author_id: contributor.pid })
    expect(res.body.config).toEqual({ message: "Improves alpha", commit: expect.stringMatching(/^[0-9a-f]{40}$/), accepted: null })

    expect(await history(post.id)).toHaveLength(1)
    expect((await api().get(`/contents/${post.id}`)).body.body).toBe("Alpha paragraph.")

    // Only the author is shown what's pending
    expect(await pendingSuggestions(post.id)).toMatchObject([{ id: res.body.id, author: contributor.name, config: res.body.config }])
    expect((await api().get(`/contents/${post.id}`).set(contributor.auth)).body.suggestions).toBeUndefined()
  })

  it("aren't recorded when they change nothing", async () => {
    const post = await newPost()

    expect((await edit(contributor, post.id, THREE_PARAGRAPHS)).status).toBe(400)
    expect(await pendingSuggestions(post.id)).toEqual([])
  })

  it("come with the version they were made on, even after the post moved on", async () => {
    const post = await newPost()
    const base = await latestCommit(post.id)
    const suggestion = await edit(contributor, post.id, "<p>Alpha paragraph.</p><p>Beta, suggested.</p><p>Gamma paragraph.</p>")
    await edit(author, post.id, "<p>Alpha paragraph.</p><p>Beta paragraph.</p><p>Gamma, by the author.</p>")

    const res = await api().get(`/contents/${post.id}/${suggestion.body.config.commit}`)

    expect(res.status).toBe(200)
    expect(res.body.body).toContain("Beta, suggested.")
    expect(res.body.base).toEqual({ commit: base, body: "<p>Alpha paragraph.</p>\n<p>Beta paragraph.</p>\n<p>Gamma paragraph.</p>\n" })
  })

  it("are merged by the author, as one step in the post's history", async () => {
    const post = await newPost()
    const suggestion = await edit(contributor, post.id, "<p>Alpha paragraph.</p><p>Beta paragraph.</p><p>Gamma, suggested.</p>", "Suggests gamma")
    // Edits to paragraphs that aren't adjacent merge cleanly, thanks to one block per line
    await edit(author, post.id, "<p>Alpha, by the author.</p><p>Beta paragraph.</p><p>Gamma paragraph.</p>")
    const commit = suggestion.body.config.commit

    const merged = await api().post(`/contents/${post.id}/${commit}/merge`).set(author.auth)
    expect(merged.status).toBe(204)

    const versions = await history(post.id)
    expect(versions.map(version => version.subject)).toContain("Suggests gamma")
    expect(versions.at(-1)!.subject).toMatch(/^Merge commit/)
    expect(await read(post.id, versions.at(-1)!.commit)).toBe("<p>Alpha, by the author.</p>\n<p>Beta paragraph.</p>\n<p>Gamma, suggested.</p>\n")

    expect(await pendingSuggestions(post.id)).toEqual([])
    expect((await api().post(`/contents/${post.id}/${commit}/merge`).set(author.auth)).status).toBe(404)
    // A merged suggestion no longer comes with a base
    expect((await api().get(`/contents/${post.id}/${commit}`)).body.base).toBeUndefined()
  })

  it("are rejected by the author without touching the post", async () => {
    const post = await newPost()
    const suggestion = await edit(contributor, post.id, "<p>Nope.</p>")
    const commit = suggestion.body.config.commit

    const res = await api().post(`/contents/${post.id}/${commit}/reject`).set(author.auth)

    expect(res.status).toBe(200)
    expect(res.body.config.accepted).toBe(false)
    expect(await pendingSuggestions(post.id)).toEqual([])
    expect(await history(post.id)).toHaveLength(1)
    expect((await api().post(`/contents/${post.id}/${commit}/merge`).set(author.auth)).status).toBe(404)
  })

  it.each(["merge", "reject"])("only the post's author can %s them", async action => {
    const post = await newPost()
    const suggestion = await edit(contributor, post.id, "<p>Mine now.</p>")

    const res = await api().post(`/contents/${post.id}/${suggestion.body.config.commit}/${action}`).set(contributor.auth)

    expect(res.status).toBe(403)
    expect(await pendingSuggestions(post.id)).toHaveLength(1)
  })

  it("can't be merged into another post", async () => {
    const post = await newPost()
    const other = await newPost()
    const suggestion = await edit(contributor, post.id, "<p>For the first post.</p>")

    const res = await api().post(`/contents/${other.id}/${suggestion.body.config.commit}/merge`).set(author.auth)

    expect(res.status).toBe(404)
  })

  it("refuses to merge a version that isn't a pending suggestion", async () => {
    const post = await newPost()
    const own = await edit(author, post.id, "<p>Author's own edit.</p>")

    expect((await api().post(`/contents/${post.id}/${own.body.commit}/merge`).set(author.auth)).status).toBe(404)
  })

  it("report a conflict when they edit the paragraph the author changed, and stay pending", async () => {
    const post = await newPost()
    const suggestion = await edit(contributor, post.id, "<p>Alpha paragraph.</p><p>Beta by contributor.</p><p>Gamma paragraph.</p>")
    await edit(author, post.id, "<p>Alpha paragraph.</p><p>Beta by author.</p><p>Gamma paragraph.</p>")
    const before = await history(post.id)

    const res = await api().post(`/contents/${post.id}/${suggestion.body.config.commit}/merge`).set(author.auth)

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Conflito no merge!")
    expect(await history(post.id)).toEqual(before)
    expect(await pendingSuggestions(post.id)).toHaveLength(1)
    // The aborted merge left the repository clean
    expect((await edit(author, post.id, "<p>After the conflict.</p>")).status).toBe(200)
  })
})

describe("cloning a post", () => {
  it("starts a new post, by whoever cloned it, from the chosen version", async () => {
    const post = await newPost()
    const first = await latestCommit(post.id)
    await edit(author, post.id, "<p>Second version.</p>")

    const res = await api().post(`/contents/${post.id}/${first}/clone`).set(contributor.auth).send({ title: "A fork" })

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ type: "post", parent_id: post.parent_id, author_id: contributor.pid, title: "A fork" })

    const cloneHistory = await history(res.body.id)
    expect(cloneHistory.map(version => version.commit)).toEqual([first])
    expect(await read(res.body.id, first)).toContain("Alpha paragraph.")

    // The clone is edited by its own author, without suggestions
    const edited = await edit(contributor, res.body.id, "<p>The fork diverges.</p>")
    expect(edited.body.commit).toBeDefined()
    expect(await history(post.id)).toHaveLength(2)
  })

  it("requires a title", async () => {
    const post = await newPost()
    const res = await api().post(`/contents/${post.id}/${await latestCommit(post.id)}/clone`).set(contributor.auth).send({})

    expect(res.status).toBe(400)
  })

  it("refuses an invalid hash and leaves no post behind", async () => {
    const post = await newPost()
    const res = await api().post(`/contents/${post.id}/not-a-hash/clone`).set(contributor.auth).send({ title: "Broken fork" })

    expect(res.status).toBe(400)
    expect(res.body.key).toBe("hash")
    // The rolled back title is free again
    const retry = await api().post(`/contents/${post.id}/${await latestCommit(post.id)}/clone`).set(contributor.auth).send({ title: "Broken fork" })
    expect(retry.status).toBe(200)
  })
})
