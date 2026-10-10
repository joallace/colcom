import { vi } from "vitest"

// Many tests here tag topics, by the same users
vi.hoisted(() => {
  process.env.TAG_CREATE_PER_DAY = "1000"
})

import { beforeAll, describe, expect, it } from "vitest"

import db, { ready } from "@/pgDatabase"
import { indexUnindexed } from "@/searchIndex"

import { api, createPost, createTopic, critique, critiqueConfig, edit, latestCommit, signUp, TestUser, unique, voteTag } from "../support/api"


let alice: TestUser, bob: TestUser

beforeAll(async () => {
  [alice, bob] = await Promise.all([signUp(), signUp()])
})

// Contents in a file share a database, so each test searches for words of its own: letters only,
// since numbers would be words too ("zqb", "zqc"…)
let words = 0
const word = () => `zq${[...(++words).toString(26)].map(digit => String.fromCharCode(97 + parseInt(digit, 26))).join("")}`

// Without a query, only `params` (the tags)
const search = async (query: string | undefined, params: Record<string, string | number> = {}, user?: TestUser) => {
  const req = api().get("/search").query({ ...(query !== undefined && { q: query }), ...params })
  const res = await (user ? req.set(user.auth) : req)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return res.body
}

const ids = async (query: string | undefined, params: Record<string, string | number> = {}) =>
  (await search(query, params)).results.map((result: any) => result.id)

describe("what's searched", () => {
  it("finds a post by its title and by any part of its text, not only the summary", async () => {
    const [inTitle, inText] = [word(), word()]
    const topic = await createTopic(alice)
    const post = await createPost(alice, topic.id, { title: unique(`Sobre ${inTitle}`), body: `<p>Resumo.</p><h2>Depois</h2><p>Bem no fim, ${inText}.</p>` })

    expect(await ids(inTitle)).toEqual([post.id])
    expect(await ids(inText)).toEqual([post.id])
  })

  it("follows a post's edits and merged suggestions", async () => {
    const [before, after, suggested] = [word(), word(), word()]
    const topic = await createTopic(alice)
    const post = await createPost(alice, topic.id, { body: `<p>Primeiro ${before}.</p>` })

    expect((await edit(alice, post.id, `<p>Primeiro ${after}.</p>`)).status).toBe(200)
    expect(await ids(before)).toEqual([])
    expect(await ids(after)).toEqual([post.id])

    // A pending suggestion isn't the post's text yet
    const suggestion = await edit(bob, post.id, `<p>Primeiro ${after}.</p><p>Mais ${suggested}.</p>`)
    expect(await ids(suggested)).toEqual([])

    expect((await api().post(`/contents/${post.id}/${suggestion.body.config.commit}/merge`).set(alice.auth)).status).toBe(204)
    expect(await ids(suggested)).toEqual([post.id])
  })

  it("indexes a clone with the version it was cloned from", async () => {
    const [old, current] = [word(), word()]
    const topic = await createTopic(alice)
    const post = await createPost(alice, topic.id, { body: `<p>Antes ${old}.</p>` })
    const first = await latestCommit(post.id)
    await edit(alice, post.id, `<p>Agora ${current}.</p>`)

    const clone = await api().post(`/contents/${post.id}/${first}/clone`).set(bob.auth).send({ title: unique("Clone") })
    expect(clone.status).toBe(200)

    expect(await ids(old)).toEqual([clone.body.id])
    expect((await ids(current)).sort()).toEqual([post.id])
  })

  it("finds a topic by its text", async () => {
    const term = word()
    const topic = await createTopic(alice, { body: `<p>Pergunta sobre ${term}?</p>` })

    expect(await ids(term)).toEqual([topic.id])
  })

  it("never returns critiques", async () => {
    const term = word()
    const topic = await createTopic(alice)
    const post = await createPost(alice, topic.id)
    const res = await critique(bob, post.id, critiqueConfig(await latestCommit(post.id)), { title: unique(`Crítica ${term}`), body: `<p>${term}</p>` })
    expect(res.status).toBe(201)

    expect(await ids(term)).toEqual([])
  })

  // Portuguese stemming has its limits: "eleição" and "eleições" are different words to it
  it("ignores accents and case, and finds other forms of a word", async () => {
    const topic = await createTopic(alice, { title: unique("Eleição dos votos") })

    expect(await ids("eleicao")).toContain(topic.id)
    expect(await ids("ELEIÇÃO")).toContain(topic.id)
    expect(await ids("voto")).toContain(topic.id)
  })

  it("takes phrases, alternatives and exclusions as people type them", async () => {
    const [a, b, c] = [word(), word(), word()]
    const topic = await createTopic(alice)
    const ab = await createPost(alice, topic.id, { body: `<p>${a} ${b}</p>` })
    const ba = await createPost(alice, topic.id, { body: `<p>${b} ${a}</p>` })
    const ac = await createPost(alice, topic.id, { body: `<p>${a} ${c}</p>` })

    expect((await ids(`${a} ${b}`)).sort()).toEqual([ab.id, ba.id].sort())
    expect(await ids(`"${a} ${b}"`)).toEqual([ab.id])
    expect((await ids(`${b} or ${c}`)).sort()).toEqual([ab.id, ba.id, ac.id].sort())
    expect(await ids(`${a} -${b}`)).toEqual([ac.id])
  })

  it("finds nothing for stop words alone", async () => {
    expect(await search("o que é")).toEqual({ results: [], count: 0, tags: [] })
  })
})

describe("tags", () => {
  it("never match as words", async () => {
    const tag = word()
    await createTopic(alice, { tags: [`Tag ${tag}`] })

    expect(await ids(tag)).toEqual([])
  })

  it("alone, list the topics showing them and their posts, newest first, named", async () => {
    const tag = word()
    const topic = await createTopic(alice, { tags: [`Tag ${tag}`] })
    const post = await createPost(bob, topic.id)
    const later = await createPost(alice, topic.id)

    const res = await search(undefined, { tags: `tag-${tag}` })
    expect(res.results.map((result: any) => result.id)).toEqual([later.id, post.id, topic.id])
    expect(res.results.every((result: any) => result.excerpt === null)).toBe(true)
    expect(res.tags).toEqual([{ slug: `tag-${tag}`, name: `Tag ${tag}`, provisional: true }])
    expect(await ids(undefined, { tags: `tag-${tag}`, type: "topic" })).toEqual([topic.id])
  })

  it("combine as an intersection, as /t does", async () => {
    const [a, b] = [word(), word()]
    const both = await createTopic(alice, { tags: [`Tag ${a}`, `Tag ${b}`] })
    await createTopic(alice, { tags: [`Tag ${a}`] })
    await createTopic(alice, { tags: [`Tag ${b}`] })

    expect(await ids(undefined, { tags: `tag-${a},tag-${b}`, type: "topic" })).toEqual([both.id])
  })

  it("narrow a query to the topics showing all of them, and their posts", async () => {
    const [term, tag] = [word(), word()]
    const tagged = await createTopic(alice, { body: `<p>${term}</p>`, tags: [`Tag ${tag}`] })
    const post = await createPost(alice, tagged.id, { body: `<p>${term}</p>` })
    const other = await createTopic(alice, { body: `<p>${term}</p>` })

    expect((await ids(term)).sort()).toEqual([tagged.id, post.id, other.id].sort())
    expect((await ids(term, { tags: `tag-${tag}` })).sort()).toEqual([tagged.id, post.id].sort())
    expect(await search(term, { tags: "nao-existe-essa" })).toEqual({ results: [], count: 0, tags: [] })
  })

  it("only while the topic shows them", async () => {
    const tag = word()
    const topic = await createTopic(alice, { tags: [`Tag ${tag}`] })

    // Contested as much as endorsed it still shows; more contests hide it
    const carol = await signUp()
    await voteTag(bob, topic.id, `Tag ${tag}`, -1)
    expect(await ids(undefined, { tags: `tag-${tag}` })).toEqual([topic.id])
    await voteTag(carol, topic.id, `Tag ${tag}`, -1)
    expect(await ids(undefined, { tags: `tag-${tag}` })).toEqual([])
  })
})

describe("results", () => {
  it("ranks a match in the title above one in the text", async () => {
    const term = word()
    const inText = await createTopic(alice, { body: `<p>${term}</p>` })
    const inTitle = await createTopic(alice, { title: unique(`Título ${term}`) })

    expect(await ids(term, { type: "topic" })).toEqual([inTitle.id, inText.id])
  })

  it("filters by type", async () => {
    const term = word()
    const topic = await createTopic(alice, { title: unique(`Tópico ${term}`) })
    const post = await createPost(alice, topic.id, { title: unique(`Post ${term}`) })

    expect(await ids(term, { type: "topic" })).toEqual([topic.id])
    expect(await ids(term, { type: "post" })).toEqual([post.id])
  })

  it("shows each as lists do, with an excerpt marking the matched words", async () => {
    const term = word()
    const topic = await createTopic(alice, { title: unique(`Tópico ${term}`) })
    const post = await createPost(alice, topic.id, { body: `<p>Resumo.</p><p>Um texto longo que fala de ${term} no meio.</p>` })

    const { results } = await search(term, {}, bob)
    const [topicResult] = results.filter((result: any) => result.type === "topic")
    const [postResult] = results.filter((result: any) => result.type === "post")

    expect(topicResult).toMatchObject({ id: topic.id, children: [expect.objectContaining({ id: post.id })], tags: [], userInteractions: [] })
    expect(postResult).toMatchObject({ id: post.id, body: "Resumo.", topic: { id: topic.id, title: topic.title }, userInteractions: [] })
    expect(postResult.excerpt).toContain(`${term}`)
    expect(postResult).not.toHaveProperty("search_text")
    expect(postResult).not.toHaveProperty("search")
  })

  it("pages them, counting all", async () => {
    const term = word()
    const topic = await createTopic(alice, { body: `<p>${term}</p>` })
    for (let i = 0; i < 4; i++)
      await createPost(alice, topic.id, { body: `<p>${term}</p>` })

    const first = await search(term, { pageSize: 2 })
    const third = await search(term, { pageSize: 2, page: 3 })
    const past = await search(term, { pageSize: 2, page: 4 })

    expect(first.count).toBe(5)
    expect(first.results).toHaveLength(2)
    expect(third.results).toHaveLength(1)
    expect(past).toEqual({ results: [], count: 5, tags: [] })
  })

  it("refuses no query and no tags, an empty query or an unknown type", async () => {
    const none = await api().get("/search")
    expect(none.status).toBe(400)
    expect(none.body.key).toBe("q")
    expect((await api().get("/search").query({ tags: "a b" })).status).toBe(400)
    expect((await api().get("/search").query({ q: "   " })).status).toBe(400)
    expect((await api().get("/search").query({ q: "a", type: "critique" })).status).toBe(400)
    expect((await api().get("/search").query({ q: "a".repeat(201) })).status).toBe(400)
  })
})

describe("contents written before search", () => {
  it("are indexed at startup, posts from their latest version", async () => {
    await ready
    const [summary, later, inTopic] = [word(), word(), word()]
    const topic = await createTopic(alice, { body: `<p>${inTopic}</p>` })
    const post = await createPost(alice, topic.id, { body: `<p>${summary}</p>` })
    await edit(alice, post.id, `<p>${summary}</p><p>${later}</p>`)
    await db.query({ text: "UPDATE contents SET search_text = NULL WHERE id = ANY($1);", values: [[topic.id, post.id]] })
    expect(await ids(later)).toEqual([])

    await indexUnindexed()

    expect(await ids(later)).toEqual([post.id])
    expect(await ids(inTopic)).toEqual([topic.id])
  })
})
