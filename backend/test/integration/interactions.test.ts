import { beforeAll, describe, expect, it } from "vitest"

import db from "@/pgDatabase"

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

  it("only go on posts", async () => {
    const topic = await createTopic(alice)
    const res = await interact(bob, topic.id, "vote")

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Só é possível votar em posts.")
  })
})

describe("poll vote history", () => {
  const votes = async (topicId: number) => (await api().get(`/topics/${topicId}/votes`)).body

  it("records a cast, a change and a removal, in order", async () => {
    const topic = await createTopic(alice)
    const [yes, no] = [await createPost(alice, topic.id), await createPost(alice, topic.id, { answer: "não" })]

    await interact(bob, yes.id, "vote")
    await interact(bob, no.id, "vote")
    await interact(bob, no.id, "vote")
    await interact(alice, yes.id, "vote")

    const res = await api().get(`/topics/${topic.id}/votes`)
    expect(res.status).toBe(200)
    expect(res.body.map(({ voter, from, to }: any) => ({ voter, from, to }))).toEqual([
      { voter: 1, from: null, to: yes.id },
      { voter: 1, from: yes.id, to: no.id },
      { voter: 1, from: no.id, to: null },
      { voter: 2, from: null, to: yes.id }
    ])
    expect(res.body[0]).not.toHaveProperty("user_id")
  })

  it("keeps each topic's history apart", async () => {
    const [first, second] = [await createTopic(alice), await createTopic(alice)]
    const [a, b] = [await createPost(alice, first.id), await createPost(alice, second.id)]
    await interact(bob, a.id, "vote")
    await interact(bob, b.id, "vote")

    expect((await votes(first.id)).map((event: any) => event.to)).toEqual([a.id])
    expect((await votes(second.id)).map((event: any) => event.to)).toEqual([b.id])
  })

  it("logs nothing for other interactions", async () => {
    const topic = await createTopic(alice)
    const post = await createPost(alice, topic.id)
    await interact(bob, post.id, "up")
    await interact(bob, post.id, "bookmark")

    expect(await votes(topic.id)).toEqual([])
  })

  it("answers 404 for a content that isn't a topic", async () => {
    const topic = await createTopic(alice)
    const post = await createPost(alice, topic.id)

    expect((await api().get(`/topics/${post.id}/votes`)).status).toBe(404)
    expect((await api().get("/topics/999999/votes")).status).toBe(404)
  })

  it("can't be edited or erased in the database", async () => {
    const topic = await createTopic(alice)
    const post = await createPost(alice, topic.id)
    await interact(bob, post.id, "vote")
    const [{ id }] = await votes(topic.id)

    await expect(db.query("UPDATE vote_events SET to_content_id = NULL WHERE id = $1", [id])).rejects.toThrow(/append-only/)
    await expect(db.query("DELETE FROM vote_events WHERE id = $1", [id])).rejects.toThrow(/append-only/)
    await expect(db.query("TRUNCATE vote_events")).rejects.toThrow(/append-only/)
    expect(await votes(topic.id)).toHaveLength(1)
  })

  it("also logs changes made outside the API", async () => {
    const topic = await createTopic(alice)
    const post = await createPost(alice, topic.id)
    await interact(bob, post.id, "vote")

    await db.query("DELETE FROM interactions WHERE type = 'vote' AND content_id = $1", [post.id])

    expect((await votes(topic.id)).map(({ from, to }: any) => ({ from, to }))).toEqual([
      { from: null, to: post.id },
      { from: post.id, to: null }
    ])
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

  it.each(["up", "down", "bookmark", "promote"])("answers 404 to %s on a content that doesn't exist", async type => {
    const res = await interact(bob, 999999, type)

    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ name: "NotFoundError", message: 'O conteúdo com "id" de valor "999999" não foi encontrado no sistema.' })
    expect(JSON.stringify(res.body)).not.toMatch(/foreign key|constraint/i)
  })
})
