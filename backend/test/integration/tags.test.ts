import { vi } from "vitest"

// The shared users create many tags here; tagLimits.test.ts checks the daily limit
vi.hoisted(() => {
  process.env.TAG_CREATE_PER_DAY = "1000"
})

import { beforeAll, describe, expect, it } from "vitest"

import db from "@/pgDatabase"

import { api, createPost, createTopic, signUp, TestUser, topicTags, unique, voteTag } from "../support/api"


let alice: TestUser, bob: TestUser, carol: TestUser

beforeAll(async () => {
  [alice, bob, carol] = await Promise.all([signUp(), signUp(), signUp()])
})

// Tag names are unique per database, so each test makes its own: "tag 12" → slug "tag-12"
const newTag = () => unique("tag")
const slugOf = (name: string) => name.replace(" ", "-")

const visible = (tags: any[]) => tags.filter(tag => tag.visible).map(tag => tag.slug)

const topicsWith = async (tags: string, user?: TestUser) => {
  const req = api().get(`/topics?tags=${tags}&with_count`)
  const res = await (user ? req.set(user.auth) : req)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return { ids: res.body.tree.map((topic: any) => topic.id), count: res.body.count }
}

describe("seeding a topic's tags", () => {
  it("endorses the author's tags, one per slug, keeping the first spelling", async () => {
    const name = `Política ${unique("x")}`
    const topic = await createTopic(alice, { tags: [name, name.toUpperCase(), name.normalize("NFD").replace(/\p{M}/gu, "")] })

    expect(topic.tags).toEqual([
      expect.objectContaining({ name, visible: true, provisional: true, endorsements: 1, contests: 0, userVote: 1 })
    ])
    expect(topic.tags[0].slug).toMatch(/^politica-x-\d+$/)
    expect(await topicTags(topic.id)).toEqual([expect.not.objectContaining({ userVote: expect.anything() })])
  })

  it("reuses existing tags, whoever created them", async () => {
    const name = newTag()
    const first = await createTopic(alice, { tags: [name] })
    const second = await createTopic(bob, { tags: [name.toUpperCase()] })

    expect(second.tags).toEqual([expect.objectContaining({ slug: first.tags[0].slug, name })])
  })

  it("lists every topic's tags, with the viewer's votes", async () => {
    const name = newTag()
    const topic = await createTopic(alice, { tags: [name] })
    await voteTag(bob, topic.id, name, -1)

    const res = await api().get("/topics?orderBy=id&pageSize=100").set(bob.auth)
    const listed = res.body.tree.find((other: any) => other.id === topic.id)
    expect(listed.tags).toEqual([expect.objectContaining({ slug: slugOf(name), endorsements: 1, contests: 1, userVote: -1 })])
  })

  it("refuses more tags than the limit, and anything but topics", async () => {
    const res = await api().post("/contents").set(alice.auth).send({ title: unique("Topic"), tags: ["um", "dois", "tres", "quatro", "cinco", "seis"] })
    expect(res.status).toBe(400)
    expect(res.body.key).toBe("tags")

    // Posts have no tags: the key is dropped
    const topic = await createTopic(alice)
    const post = await api().post("/contents").set(alice.auth).send({ title: unique("Post"), parent_id: topic.id, body: "<p>Yes.</p>", config: { answer: "sim" }, tags: [newTag()] })
    expect(post.status).toBe(201)
    expect(post.body.tags).toBeUndefined()
    expect((await voteTag(alice, post.body.id, newTag(), 1)).status).toBe(400)
  })
})

describe("curating tags", () => {
  it("shows a tag while it has at least as many endorsements as contests", async () => {
    const name = newTag()
    const topic = await createTopic(alice, { tags: [name] })

    // A tie keeps it: one contest can't remove the author's tag
    expect(visible((await voteTag(bob, topic.id, name, -1)).body.tags)).toEqual([slugOf(name)])

    const res = await voteTag(carol, topic.id, name, -1)
    expect(res.status).toBe(200)
    expect(res.body.tags).toEqual([expect.objectContaining({ visible: false, endorsements: 1, contests: 2, userVote: -1 })])
    expect((await topicsWith(slugOf(name))).ids).toEqual([])

    // Changing a vote, then withdrawing one, brings it back
    await voteTag(carol, topic.id, name, 1)
    expect(visible(await topicTags(topic.id))).toEqual([slugOf(name)])
    await voteTag(carol, topic.id, name, 0)
    expect((await topicTags(topic.id))[0]).toMatchObject({ endorsements: 1, contests: 1, visible: true })
  })

  it("proposes a tag by endorsing it, and drops it once nobody votes for it", async () => {
    const topic = await createTopic(alice)
    const name = newTag()

    const res = await voteTag(bob, topic.id, name, 1)
    expect(res.body.tags).toEqual([expect.objectContaining({ slug: slugOf(name), name, visible: true, userVote: 1 })])

    await voteTag(bob, topic.id, name, 0)
    expect(await topicTags(topic.id)).toEqual([])
  })

  it("refuses contesting or withdrawing a tag the topic doesn't have", async () => {
    const topic = await createTopic(alice)
    const other = await createTopic(alice, { tags: [newTag()] })
    const name = other.tags[0].name

    for (const value of [-1, 0] as const) {
      const res = await voteTag(bob, topic.id, name, value)
      expect(res.status).toBe(400)
      expect(res.body.key).toBe("tag")
    }
  })

  it("caps how many tags a topic can have proposed", async () => {
    const topic = await createTopic(alice, { tags: Array.from({ length: 5 }, newTag) })
    for (let i = 0; i < 5; i++)
      expect((await voteTag(alice, topic.id, newTag(), 1)).status).toBe(200)

    const res = await voteTag(alice, topic.id, newTag(), 1)
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/até 10 tags/)

    // Voting on the proposed ones is still fine
    expect((await voteTag(bob, topic.id, (await topicTags(topic.id))[0].name, -1)).status).toBe(200)
  })

  it("needs a session and a topic", async () => {
    const topic = await createTopic(alice)
    // A missing token is a 400 across the API (authHandler)
    const anonymous = await api().post(`/topics/${topic.id}/tags`).send({ tag: newTag(), value: 1 })
    expect(anonymous.status).toBe(400)
    expect(anonymous.body.message).toMatch(/Token/)
    expect((await voteTag(alice, 999999, newTag(), 1)).status).toBe(404)
    expect((await voteTag(alice, topic.id, "c++", 1)).status).toBe(400)
  })

  it("logs every vote, with voters numbered per topic", async () => {
    const name = newTag()
    const topic = await createTopic(alice, { tags: [name] })
    await voteTag(bob, topic.id, name, -1)
    await voteTag(bob, topic.id, name, 1)
    await voteTag(alice, topic.id, name, 0)

    const res = await api().get(`/topics/${topic.id}/tags/history`)
    expect(res.status).toBe(200)
    expect(res.body.map(({ voter, tag, from, to }: any) => ({ voter, tag, from, to }))).toEqual([
      { voter: 1, tag: slugOf(name), from: null, to: 1 },
      { voter: 2, tag: slugOf(name), from: null, to: -1 },
      { voter: 2, tag: slugOf(name), from: -1, to: 1 },
      { voter: 1, tag: slugOf(name), from: 1, to: null }
    ])

    const post = await createPost(alice, topic.id)
    expect((await api().get(`/topics/${post.id}/tags/history`)).status).toBe(404)
  })

  it("keeps the log append-only in the database", async () => {
    const topic = await createTopic(alice, { tags: [newTag()] })
    const [{ id }] = (await api().get(`/topics/${topic.id}/tags/history`)).body

    await expect(db.query("UPDATE tag_events SET to_value = -1 WHERE id = $1", [id])).rejects.toThrow(/append-only/)
    await expect(db.query("DELETE FROM tag_events WHERE id = $1", [id])).rejects.toThrow(/append-only/)
    await expect(db.query("TRUNCATE tag_events")).rejects.toThrow(/append-only/)
  })
})

describe("creating tags", () => {
  it("starts provisional and activates on enough topics by two authors", async () => {
    const name = newTag()
    await createTopic(alice, { tags: [name] })
    await createTopic(alice, { tags: [name] })
    await createTopic(alice, { tags: [name] })
    // Three topics, one author
    expect((await api().get(`/tags/${slugOf(name)}`)).body.tags[0].provisional).toBe(true)

    await createTopic(bob, { tags: [name] })
    expect((await api().get(`/tags/${slugOf(name)}`)).body.tags[0].provisional).toBe(false)
  })

  it("expires a provisional tag that's too old, which can't be used anymore", async () => {
    const name = newTag()
    const topic = await createTopic(alice, { tags: [name] })
    await db.query("UPDATE tags SET created_at = now() - INTERVAL '31 days' WHERE slug = $1", [slugOf(name)])

    expect(await topicTags(topic.id)).toEqual([])
    expect((await api().get(`/tags/${slugOf(name)}`)).status).toBe(404)
    expect((await topicsWith(slugOf(name))).ids).toEqual([])
    expect((await api().get(`/tags?q=${slugOf(name)}`)).body.tags).toEqual([])

    const res = await voteTag(bob, topic.id, name, 1)
    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/expirou/)
    expect((await api().post("/contents").set(bob.auth).send({ title: unique("Topic"), tags: [name] })).body.key).toBe("tags.0")
  })

  it("keeps an active tag however old", async () => {
    const name = newTag()
    for (const author of [alice, alice, bob])
      await createTopic(author, { tags: [name] })
    await db.query("UPDATE tags SET created_at = now() - INTERVAL '365 days' WHERE slug = $1", [slugOf(name)])

    expect((await api().get(`/tags/${slugOf(name)}`)).status).toBe(200)
  })
})

describe("browsing by tag", () => {
  it("filters topics having all the tags, and counts them", async () => {
    const [a, b, c] = [newTag(), newTag(), newTag()]
    const ab = await createTopic(alice, { tags: [a, b] })
    const abc = await createTopic(bob, { tags: [a, b, c] })
    const onlyA = await createTopic(alice, { tags: [a] })

    expect(await topicsWith(slugOf(a))).toEqual({ ids: expect.arrayContaining([ab.id, abc.id, onlyA.id]), count: 3 })
    expect((await topicsWith(`${slugOf(a)},${slugOf(b)}`)).ids.sort()).toEqual([ab.id, abc.id].sort())
    expect(await topicsWith(`${slugOf(c)},${slugOf(a)},${slugOf(b)}`)).toEqual({ ids: [abc.id], count: 1 })
    expect(await topicsWith(`${slugOf(a)},nao-existe`)).toEqual({ ids: [], count: 0 })
    expect((await api().get("/topics?tags=A,,b")).status).toBe(400)
  })

  it("describes an intersection with the tags its topics have most", async () => {
    const [a, b, c, d] = [newTag(), newTag(), newTag(), newTag()]
    await createTopic(alice, { tags: [a, b, c] })
    await createTopic(alice, { tags: [a, b] })
    await createTopic(bob, { tags: [a, c, d] })

    const res = await api().get(`/tags/${slugOf(a)}`)
    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ tags: [{ slug: slugOf(a), name: a }], canonical: slugOf(a), topics: 3 })
    expect(res.body.related.map((tag: any) => [tag.slug, tag.topics])).toEqual([[slugOf(b), 2], [slugOf(c), 2], [slugOf(d), 1]])

    const narrower = await api().get(`/tags/${slugOf(a)},${slugOf(c)}`)
    expect(narrower.body.topics).toBe(2)
    expect(narrower.body.related.map((tag: any) => tag.slug)).toEqual([slugOf(b), slugOf(d)])

    expect((await api().get("/tags/nao-existe")).status).toBe(404)
  })

  it("finds tags by part of their slug, the ones starting with it first", async () => {
    const stem = unique("busca").replace(" ", "")
    await createTopic(alice, { tags: [`x ${stem}`, `${stem} y`] })

    const res = await api().get(`/tags?q=${stem.toUpperCase()}`)
    expect(res.status).toBe(200)
    expect(res.body.tags.map((tag: any) => tag.slug)).toEqual([`${stem}-y`, `x-${stem}`])
    expect(res.body.count).toBe(2)
  })

  it("follows a merged tag to the one it was merged into", async () => {
    const [duplicate, target] = [newTag(), newTag()]
    const both = await createTopic(alice, { tags: [duplicate, target] })
    const onlyDuplicate = await createTopic(bob, { tags: [duplicate] })
    await voteTag(carol, onlyDuplicate.id, duplicate, -1)

    await db.query("SELECT merge_tag($1, $2)", [slugOf(duplicate), slugOf(target)])

    // Votes moved over, except where the voter had already voted on the target
    expect(await topicTags(both.id)).toEqual([expect.objectContaining({ slug: slugOf(target), endorsements: 1 })])
    expect(await topicTags(onlyDuplicate.id)).toEqual([expect.objectContaining({ slug: slugOf(target), endorsements: 1, contests: 1 })])

    expect((await topicsWith(slugOf(duplicate))).ids.sort()).toEqual([both.id, onlyDuplicate.id].sort())
    expect((await api().get(`/tags/${slugOf(duplicate)},${slugOf(target)}`)).body).toMatchObject({ canonical: slugOf(target), topics: 2 })

    // Using the old name uses the tag it went into
    const topic = await createTopic(carol, { tags: [duplicate] })
    expect(topic.tags.map((tag: any) => tag.slug)).toEqual([slugOf(target)])
  })
})
