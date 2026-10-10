import { beforeAll, describe, expect, it } from "vitest"

import db, { ready } from "@/pgDatabase"
import { ensureMeta, SYSTEM_USER } from "@/meta"
import { META_GROUPS } from "@/metaTopics"

import { AVATAR, api, createTopic, signUp, TestUser, topicTags, unique, voteTag } from "../support/api"


const titles = META_GROUPS.flatMap(group => group.topics.map(topic => topic.title))

const getMeta = async (user?: TestUser) => {
  const req = api().get("/meta")
  const res = await (user ? req.set(user.auth) : req)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return res.body.groups
}

const metaTopics = async () => (await getMeta()).flatMap((group: any) => group.topics)

// Runs first: the server opens the meta topics at startup, which tests do by hand
it("lists the groups empty before the first start", async () => {
  const groups = await getMeta()

  expect(groups.map((group: any) => group.key)).toEqual(META_GROUPS.map(group => group.key))
  expect(groups.every((group: any) => group.topics.length === 0)).toBe(true)
})

describe("once the instance started", () => {
  let alice: TestUser

  beforeAll(async () => {
    await ready
    await ensureMeta()
    alice = await signUp()
  })

  it("opens every foundational topic, in its group and order, by the system account", async () => {
    const groups = await getMeta()

    expect(groups.map((group: any) => group.topics.map((topic: any) => topic.title)))
      .toEqual(META_GROUPS.map(group => group.topics.map(topic => topic.title)))
    for (const topic of groups.flatMap((group: any) => group.topics))
      expect(topic.author).toBe(SYSTEM_USER.name)
  })

  it("keeps each topic's answers, open or fixed", async () => {
    const topics = await metaTopics()
    const answersOf = (title: string) => topics.find((topic: any) => topic.title === title).config.answers

    expect(answersOf("Por que o colcom existe?")).toEqual([])
    expect(answersOf("O colcom promove o consenso?")).toEqual(["sim", "não", "em parte"])
  })

  it("writes each topic to its own repo, which posts branch from", async () => {
    const [topic] = await metaTopics()
    const res = await api().post("/contents").set(alice.auth)
      .send({ title: unique("Post"), body: "<p>Para aproximar a opinião coletiva.</p>", parent_id: topic.id, config: {} })

    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect((await api().get(`/contents/${res.body.id}`)).body.history).toHaveLength(1)
  })

  it("tags them with the reserved tag, a vote logged like anyone's", async () => {
    const [topic] = await metaTopics()

    expect(await topicTags(topic.id)).toEqual([
      expect.objectContaining({ slug: "meta", name: "Meta", reserved: true, provisional: false, visible: true, endorsements: 1 })
    ])
    const history = await api().get(`/topics/${topic.id}/tags/history`)
    expect(history.body).toEqual([expect.objectContaining({ tag: "meta", from: null, to: 1 })])

    const tagged = await api().get("/tags/meta")
    expect(tagged.body.topics).toBe(titles.length)
  })

  it("changes nothing when started again", async () => {
    const before = await metaTopics()
    const events = async () => (await db.query("SELECT COUNT(*)::INT AS count FROM tag_events")).rows[0].count
    const eventsBefore = await events()

    await ensureMeta()

    expect((await metaTopics()).map((topic: any) => topic.id)).toEqual(before.map((topic: any) => topic.id))
    expect(await events()).toBe(eventsBefore)
  })

  it("opens a topic added to the definitions on the next start", async () => {
    const [group] = META_GROUPS
    const added = { title: unique("Nova pergunta meta"), body: "<p>?</p>", answers: [] }
    group.topics.push(added)

    try {
      await ensureMeta()
      expect((await getMeta())[0].topics.at(-1)).toEqual(expect.objectContaining({ title: added.title }))
    }
    finally {
      group.topics.pop()
    }
  })

  describe("the reserved tag", () => {
    it("can't be given to a new topic", async () => {
      const res = await api().post("/contents").set(alice.auth)
        .send({ title: unique("Topic"), body: "<p>?</p>", config: { answers: [] }, tags: ["Política", "meta"] })

      expect(res.status).toBe(403)
      expect(res.body).toEqual(expect.objectContaining({ key: "tags.1", message: expect.stringContaining("reservada") }))
    })

    it("can't be proposed on another topic, even by its author", async () => {
      const topic = await createTopic(alice)
      const res = await voteTag(alice, topic.id, "Meta", 1)

      expect(res.status).toBe(403)
      expect(await topicTags(topic.id)).toEqual([])
    })

    it("can't be contested or withdrawn on a meta topic", async () => {
      const [topic] = await metaTopics()

      expect((await voteTag(alice, topic.id, "meta", -1)).status).toBe(403)
      expect((await voteTag(alice, topic.id, "meta", 0)).status).toBe(403)
      expect(await topicTags(topic.id)).toEqual([expect.objectContaining({ slug: "meta", endorsements: 1, contests: 0 })])
    })

    it("leaves the meta topics' other tags to everyone", async () => {
      const [, topic] = await metaTopics()
      const res = await voteTag(alice, topic.id, unique("tag"), 1)

      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.tags.map((tag: any) => tag.slug)).toContain("meta")
    })

    it("isn't suggested by the autocomplete", async () => {
      const res = await api().get("/tags?q=meta")
      expect(res.body.tags.map((tag: any) => tag.slug)).not.toContain("meta")
    })
  })

  describe("the system account", () => {
    it("can't be logged into, with any password", async () => {
      for (const pass of ["!", "", "colcom123"]) {
        const res = await api().post("/login").send({ login: SYSTEM_USER.name, pass })
        expect(res.status).not.toBe(200)
      }
    })

    it("keeps its name and email from being signed up for", async () => {
      const byName = await api().post("/users").send({ name: SYSTEM_USER.name, email: `${unique("x").replace(" ", "")}@colcom.test`, pass: "correct horse battery", avatar: AVATAR })
      expect(byName.status).toBeGreaterThanOrEqual(400)
    })

    it("has a public profile, like the authors of every topic", async () => {
      const res = await api().get(`/users/${SYSTEM_USER.name}`)
      expect(res.status).toBe(200)
      expect(res.body.avatar).toEqual(expect.any(String))
    })
  })
})
