import { beforeAll, describe, expect, it } from "vitest"

import { api, createPost, createTopic, interact, signUp, TestUser } from "../support/api"


let alice: TestUser, bob: TestUser

beforeAll(async () => {
  [alice, bob] = await Promise.all([signUp(), signUp()])
})

const counts = async (contentId: number, user: TestUser) => {
  const { body } = await api().get(`/contents/${contentId}`).set(user.auth)
  return { upvotes: body.upvotes, downvotes: body.downvotes, mine: body.userInteractions }
}

describe("relevance votes (up and down)", () => {
  it("toggle, and switching replaces the previous one", async () => {
    const topic = await createTopic(alice)

    expect((await interact(bob, topic.id, "up")).status).toBe(201)
    expect(await counts(topic.id, bob)).toEqual({ upvotes: 1, downvotes: 0, mine: ["up"] })

    const switched = await interact(bob, topic.id, "down")
    expect(switched.status).toBe(200)
    expect(switched.body.type).toBe("down")
    expect(await counts(topic.id, bob)).toEqual({ upvotes: 0, downvotes: 1, mine: ["down"] })

    expect((await interact(bob, topic.id, "down")).status).toBe(204)
    expect(await counts(topic.id, bob)).toEqual({ upvotes: 0, downvotes: 0, mine: [] })
  })

  it("count each user once", async () => {
    const topic = await createTopic(alice)
    await interact(alice, topic.id, "up")
    await interact(bob, topic.id, "up")

    expect(await counts(topic.id, alice)).toEqual({ upvotes: 2, downvotes: 0, mine: ["up"] })
  })

  it("survive a double click without duplicates or server errors", async () => {
    const topic = await createTopic(alice)
    const results = await Promise.all([interact(bob, topic.id, "up"), interact(bob, topic.id, "up")])

    for (const res of results)
      expect([201, 204, 409]).toContain(res.status)
    expect((await counts(topic.id, bob)).upvotes).toBeLessThanOrEqual(1)
  })
})

describe("poll votes", () => {
  it("allow one per topic: voting for another post moves the vote", async () => {
    const topic = await createTopic(alice)
    const [yes, no] = [await createPost(alice, topic.id), await createPost(alice, topic.id, { answer: "não" })]
    const userVote = async () => (await api().get(`/topics/${topic.id}`).set(bob.auth)).body.userVote

    expect((await interact(bob, yes.id, "vote")).status).toBe(201)
    expect(await userVote()).toBe(yes.id)

    const moved = await interact(bob, no.id, "vote")
    expect(moved.status).toBe(200)
    expect(moved.body.content_id).toBe(no.id)
    expect(await userVote()).toBe(no.id)

    expect((await interact(bob, no.id, "vote")).status).toBe(204)
    expect(await userVote()).toBeNull()
  })

  it("are independent across topics", async () => {
    const [first, second] = [await createTopic(alice), await createTopic(alice)]
    const [a, b] = [await createPost(alice, first.id), await createPost(alice, second.id)]

    expect((await interact(bob, a.id, "vote")).status).toBe(201)
    expect((await interact(bob, b.id, "vote")).status).toBe(201)
  })

  it("answer 404 for a content that doesn't exist", async () => {
    expect((await interact(bob, 999999, "vote")).status).toBe(404)
  })
})

describe("bookmarks", () => {
  it("toggle", async () => {
    const topic = await createTopic(alice)

    expect((await interact(bob, topic.id, "bookmark")).status).toBe(201)
    expect((await counts(topic.id, bob)).mine).toEqual(["bookmark"])
    expect((await interact(bob, topic.id, "bookmark")).status).toBe(204)
    expect((await counts(topic.id, bob)).mine).toEqual([])
  })
})

describe("promotions", () => {
  it("last until the end of the day and move between topics", async () => {
    const [first, second] = [await createTopic(alice), await createTopic(alice)]

    const created = await interact(bob, first.id, "promote")
    expect(created.status).toBe(201)
    const validUntil = new Date(created.body.config.valid_until)
    const endOfDay = new Date(new Date().setHours(23, 59, 59, 999))
    expect(validUntil.getTime()).toBe(endOfDay.getTime())
    expect((await api().get("/users/self").set(bob.auth)).body.promoting).toBe(first.id)

    const moved = await interact(bob, second.id, "promote")
    expect(moved.status).toBe(200)
    expect((await api().get("/users/self").set(bob.auth)).body.promoting).toBe(second.id)

    const topics = (await api().get("/topics").query({ pageSize: 100 })).body.tree
    expect(topics.find((topic: any) => topic.id === first.id).promotions).toBe(0)
    expect(topics.find((topic: any) => topic.id === second.id).promotions).toBe(1)

    expect((await interact(bob, second.id, "promote")).status).toBe(204)
    expect((await api().get("/users/self").set(bob.auth)).body.promoting).toBeUndefined()
  })
})

describe("POST /interactions", () => {
  it("refuses an unknown type", async () => {
    const topic = await createTopic(alice)
    const res = await interact(bob, topic.id, "suggestion")

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ key: "type", message: "Tipo de interação: deve ser um destes: up, down, vote, bookmark, promote." })
  })

  it("requires the user to be logged in", async () => {
    const topic = await createTopic(alice)
    expect((await api().post("/interactions").send({ content_id: topic.id, type: "up" })).status).toBe(400)
  })

  it("doesn't leak database details when it fails", async () => {
    const res = await interact(bob, 999999, "up")

    expect(res.status).toBe(500)
    expect(res.body.name).toBe("InternalServerError")
    expect(JSON.stringify(res.body)).not.toMatch(/interactions|contents|foreign key|constraint/i)
  })
})

describe("GET /contents/:id/interactions", () => {
  // Known bug: the content router's GET /contents/:id/:hash is registered first and takes
  // "interactions" as a hash (400). Nothing calls this route yet. Drop `.fails` once it's fixed.
  it.fails("lists a content's interactions with their authors", async () => {
    const topic = await createTopic(alice)
    await interact(alice, topic.id, "up")
    await interact(bob, topic.id, "bookmark")

    const res = await api().get(`/contents/${topic.id}/interactions`)

    expect(res.status).toBe(200)
    expect(res.body.map((interaction: any) => [interaction.author, interaction.type]).sort()).toEqual([[alice.name, "up"], [bob.name, "bookmark"]].sort())
  })
})
