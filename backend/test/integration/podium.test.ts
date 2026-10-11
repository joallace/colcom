// The podium ranks everything in the database, so it has a file of its own, and each test starts
// with no relevance votes and nobody's prestige
import { beforeAll, beforeEach, describe, expect, it } from "vitest"
import { PODIUM_SIZE } from "@colcom/shared"

import db from "@/pgDatabase"
import { ensureMeta, SYSTEM_USER } from "@/meta"

import { api, createPost, createTopic, interact, signUp, TestUser } from "../support/api"


let author: TestUser
let voters: TestUser[]

beforeAll(async () => {
  author = await signUp()
  voters = await Promise.all(Array.from({ length: 6 }, () => signUp()))
})

beforeEach(async () => {
  await db.query("DELETE FROM interactions WHERE type IN ('up', 'down');")
  await db.query("UPDATE users SET prestige = 0;")
})

// The first `ups` voters (from `from` on) vote it up, and the next `downs` vote it down
async function vote(contentId: number, ups: number, downs = 0, from = 0) {
  for (const [i, voter] of voters.slice(from, from + ups + downs).entries()) {
    const res = await interact(voter, contentId, i < ups ? "up" : "down")
    expect(res.status, JSON.stringify(res.body)).toBe(201)
  }
}

// As if the content's relevance votes had been cast `days` ago
const age = (contentId: number, days: number) =>
  db.query("UPDATE interactions SET created_at = now() - make_interval(days => $2) WHERE content_id = $1 AND type IN ('up', 'down');", [contentId, days])

const setPrestige = (user: TestUser, prestige: number) =>
  db.query("UPDATE users SET prestige = $2 WHERE pid = $1;", [user.pid, prestige])

async function contents(query: Record<string, string> = {}) {
  const res = await api().get("/podium/contents").query(query)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return res.body.contents
}

async function users() {
  const res = await api().get("/podium/users")
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return res.body.users
}

// Each one's id (or public id) and position, in the order sent
const standings = (ranked: any[]) => ranked.map(entry => [entry.id ?? entry.pid, entry.position])

describe("GET /podium/contents", () => {
  it("ranks topics by how many more up votes than down votes they got, leaving out the rest", async () => {
    const [first, second, even, negative] = [await createTopic(author), await createTopic(author), await createTopic(author), await createTopic(author)]
    await vote(first.id, 3)
    await vote(second.id, 4, 2)
    await vote(even.id, 1, 1)
    await vote(negative.id, 1, 3)

    const ranked = await contents()

    expect(standings(ranked)).toEqual([[first.id, 1], [second.id, 2]])
    expect(ranked[0]).toMatchObject({ title: first.title, score: 3, upvotes: 3, downvotes: 0, author: author.name, author_id: author.pid })
    expect(ranked[1]).toMatchObject({ score: 2, upvotes: 4, downvotes: 2 })
    expect(typeof ranked[0].author_avatar).toBe("string")
    expect(ranked[0]).not.toHaveProperty("topic")
  })

  it("puts equal balances on the same position, the oldest first", async () => {
    const [older, newer, third] = [await createTopic(author), await createTopic(author), await createTopic(author)]
    await vote(newer.id, 2)
    await vote(older.id, 3, 1)
    await vote(third.id, 1)

    expect(standings(await contents())).toEqual([[older.id, 1], [newer.id, 1], [third.id, 3]])
  })

  it("counts only the votes cast in the period, the last week by default", async () => {
    const [recent, old] = [await createTopic(author), await createTopic(author)]
    await vote(recent.id, 2)
    await age(recent.id, 10)
    await vote(recent.id, 1, 0, 2)
    await vote(old.id, 2)
    await age(old.id, 40)

    const scores = async (period?: string) =>
      (await contents(period ? { period } : {})).map((entry: any) => [entry.id, entry.score])

    expect(await scores()).toEqual([[recent.id, 1]])
    expect(await scores("week")).toEqual([[recent.id, 1]])
    expect(await scores("month")).toEqual([[recent.id, 3]])
    expect(await scores("all")).toEqual([[recent.id, 3], [old.id, 2]])
  })

  it("counts a vote turned over as cast when it was turned", async () => {
    const topic = await createTopic(author)
    await vote(topic.id, 1)
    await age(topic.id, 10)
    await vote(topic.id, 2, 0, 1)

    // The first voter changes their mind: a down vote cast now
    expect((await interact(voters[0], topic.id, "down")).status).toBe(200)

    expect((await contents())[0]).toMatchObject({ id: topic.id, score: 1, upvotes: 2, downvotes: 1 })
  })

  it("never counts the author's own votes", async () => {
    const [voted, selfVoted] = [await createTopic(author), await createTopic(author)]
    await interact(author, voted.id, "up")
    await interact(author, selfVoted.id, "up")
    await vote(voted.id, 1)

    const ranked = await contents()

    expect(standings(ranked)).toEqual([[voted.id, 1]])
    expect(ranked[0]).toMatchObject({ score: 1, upvotes: 1 })
  })

  it("ranks posts with the topic they answer and the answer they defend", async () => {
    const topic = await createTopic(author)
    const post = await createPost(author, topic.id, { answer: "não" })
    await vote(topic.id, 3)
    await vote(post.id, 2)

    const ranked = await contents({ type: "post" })

    expect(standings(ranked)).toEqual([[post.id, 1]])
    expect(ranked[0]).toMatchObject({
      title: post.title,
      score: 2,
      config: { answer: "não" },
      topic: { id: topic.id, title: topic.title }
    })
  })

  it(`ranks at most ${PODIUM_SIZE}`, async () => {
    const topics = []
    for (let i = 0; i < PODIUM_SIZE + 2; i++) {
      const topic = await createTopic(author)
      await vote(topic.id, 1)
      topics.push(topic.id)
    }

    expect((await contents()).map((entry: any) => entry.id)).toEqual(topics.slice(0, PODIUM_SIZE))
  })

  it("refuses an unknown type or period", async () => {
    const period = await api().get("/podium/contents").query({ period: "year" })
    expect(period.status).toBe(400)
    expect(period.body.key).toBe("period")

    const type = await api().get("/podium/contents").query({ type: "critique" })
    expect(type.status).toBe(400)
    expect(type.body.key).toBe("type")
  })
})

describe("GET /podium/users", () => {
  it("ranks users by prestige, equals on the same position and the oldest account first", async () => {
    const [oldest, middle, newest] = [await signUp(), await signUp(), await signUp()]
    await setPrestige(newest, 5)
    await setPrestige(middle, 9)
    await setPrestige(oldest, 5)

    const ranked = await users()

    expect(standings(ranked)).toEqual([[middle.pid, 1], [oldest.pid, 2], [newest.pid, 2]])
    expect(ranked[0]).toEqual({ position: 1, pid: middle.pid, name: middle.name, avatar: expect.any(String), prestige: 9 })
  })

  it("leaves out who has no prestige, so there's no one before anyone earns any", async () => {
    expect(await users()).toEqual([])
  })

  it("leaves out the system account", async () => {
    await ensureMeta()
    await db.query("UPDATE users SET prestige = 100 WHERE email = $1;", [SYSTEM_USER.email])
    await setPrestige(author, 1)

    expect(standings(await users())).toEqual([[author.pid, 1]])
  })
})
