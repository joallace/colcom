import { vi } from "vitest"

// The suite lets brand new accounts create tags (vitest.config.ts); this file uses the defaults.
// Hoisted so they're set before config.ts is imported.
vi.hoisted(() => {
  process.env.TAG_MIN_ACCOUNT_DAYS = "7"
  process.env.TAG_CREATE_PER_DAY = "3"
})

import { beforeAll, describe, expect, it } from "vitest"

import db from "@/pgDatabase"

import { api, createTopic, signUp, TestUser, unique, voteTag } from "../support/api"


const age = (user: TestUser, days: number) =>
  db.query("UPDATE users SET created_at = now() - make_interval(days => $2) WHERE pid = $1", [user.pid, days])

const newTag = () => unique("tag")

let veteran: TestUser

beforeAll(async () => {
  veteran = await signUp()
  await age(veteran, 30)
})

describe("new accounts", () => {
  it("can't create tags, but can use existing ones on their topics", async () => {
    const newcomer = await signUp()
    const name = newTag()
    const title = unique("Topic")

    const res = await api().post("/contents").set(newcomer.auth).send({ title, tags: [name] })
    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/menos de 7 dias/)
    // Nothing was written: the title is still free
    const existing = (await createTopic(veteran, { tags: [name] })).tags[0].name
    const topic = await createTopic(newcomer, { title, tags: [existing] })
    expect(topic.tags).toHaveLength(1)

    // And curate their own topic's tags
    expect((await voteTag(newcomer, topic.id, existing, 0)).status).toBe(200)
    expect((await voteTag(newcomer, topic.id, newTag(), 1)).status).toBe(403)
  })

  it("can't vote on other people's topics' tags until out of probation", async () => {
    const newcomer = await signUp()
    const name = newTag()
    const topic = await createTopic(veteran, { tags: [name] })

    const res = await voteTag(newcomer, topic.id, name, -1)
    expect(res.status).toBe(403)
    expect(res.body.message).toMatch(/próprios tópicos/)

    await age(newcomer, 7)
    expect((await voteTag(newcomer, topic.id, name, -1)).status).toBe(200)
  })
})

describe("the daily limit", () => {
  it("allows a few new tags per user per day, and using existing ones freely", async () => {
    const user = await signUp()
    await age(user, 30)
    const topic = await createTopic(user, { tags: [newTag(), newTag()] })
    expect((await voteTag(user, topic.id, newTag(), 1)).status).toBe(200)

    const res = await voteTag(user, topic.id, newTag(), 1)
    expect(res.status).toBe(429)
    expect(res.body.message).toMatch(/até 3 tags por dia/)

    const existing = (await createTopic(veteran, { tags: [newTag()] })).tags[0].name
    expect((await voteTag(user, topic.id, existing, 1)).status).toBe(200)
  })

  it("is checked before the topic is created", async () => {
    const user = await signUp()
    await age(user, 30)
    const title = unique("Topic")
    const res = await api().post("/contents").set(user.auth).send({ title, tags: [newTag(), newTag(), newTag(), newTag()] })

    expect(res.status).toBe(429)
    expect((await createTopic(user, { title })).title).toBe(title)
  })
})
