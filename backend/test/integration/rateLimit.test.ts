import { vi } from "vitest"

// The suite runs with the limits off (vitest.config.ts); this file turns them on, low. Hoisted so
// they're set before config.ts is imported.
vi.hoisted(() => {
  process.env.RATE_LIMIT_LOGIN = "3/1m"
  process.env.RATE_LIMIT_SIGN_UP = "2/1h"
  process.env.RATE_LIMIT_CONTENTS = "3/1m"
  process.env.RATE_LIMIT_INTERACTIONS = "3/1m"
})

import { beforeAll, describe, expect, it } from "vitest"

import { AVATAR, TestUser, api, createTopic, signUp, unique } from "../support/api"


// supertest connects from loopback, which the default TRUST_PROXY trusts, so each test can act as a
// different client through X-Forwarded-For, as nginx would report it
const from = (ip: string) => ({ "X-Forwarded-For": ip })

const expectTooMany = (res: { status: number, body: any }) => {
  expect(res.status).toBe(429)
  expect(res.body).toMatchObject({ name: "TooManyRequestsError", statusCode: 429 })
  expect(res.body.message).toMatch(/muit[ao]s/i)
  expect(res.body.action).toBe("Aguarde alguns minutos e tente novamente.")
  expect(res.body).not.toHaveProperty("stack")
}

// The only two sign-ups from the default address, which the sign-up limit allows
let author: TestUser
let other: TestUser
let topicId: number

beforeAll(async () => {
  author = await signUp()
  other = await signUp()
  topicId = (await createTopic(author)).id
})

describe("rate limits", () => {
  it("blocks an address after too many failed logins, not after successful ones", async () => {
    for (let i = 0; i < 5; i++)
      expect((await api().post("/login").set(from("198.51.100.1")).send({ login: author.name, pass: author.pass })).status).toBe(200)

    for (let i = 0; i < 3; i++)
      expect((await api().post("/login").set(from("198.51.100.2")).send({ login: author.name, pass: "wrong password" })).status).toBe(400)

    // Even the right password, or the guessing could go on
    expectTooMany(await api().post("/login").set(from("198.51.100.2")).send({ login: author.name, pass: author.pass }))
    expect((await api().post("/login").set(from("198.51.100.3")).send({ login: author.name, pass: author.pass })).status).toBe(200)
  })

  it("limits sign-ups per address", async () => {
    const signUpFrom = (ip: string) => {
      const name = unique("limited").replace(" ", "_")
      return api().post("/users").set(from(ip)).send({ name, email: `${name}@colcom.test`, pass: "correct horse battery staple", avatar: AVATAR })
    }

    expect((await signUpFrom("203.0.113.1")).status).toBe(201)
    expect((await signUpFrom("203.0.113.1")).status).toBe(201)
    expectTooMany(await signUpFrom("203.0.113.1"))
    expect((await signUpFrom("203.0.113.2")).status).toBe(201)
  })

  it("limits contents per user, wherever they come from", async () => {
    for (let i = 0; i < 3; i++)
      await createTopic(other)

    expectTooMany(await api().post("/contents").set(other.auth).set(from("192.0.2.9"))
      .send({ title: unique("Topic"), body: "<p>One too many.</p>", config: { answers: ["sim", "não"] } }))
    // Edits count too
    expectTooMany(await api().patch(`/contents/${topicId}`).set(other.auth).send({ body: "<p>Edited.</p>", message: "edit" }))

    // Another user on the same address isn't affected
    await createTopic(author)
  })

  it("limits interactions per user", async () => {
    const bookmark = (user: TestUser) => api().post("/interactions").set(user.auth).send({ content_id: topicId, type: "bookmark" })

    for (let i = 0; i < 3; i++)
      expect((await bookmark(other)).status).toBeLessThan(300)

    expectTooMany(await bookmark(other))
    expect((await bookmark(author)).status).toBeLessThan(300)
  })

  it("sends the standard RateLimit headers", async () => {
    const res = await api().post("/login").set(from("198.51.100.9")).send({ login: author.name, pass: "wrong password" })
    expect(res.headers).toHaveProperty("ratelimit")
    expect(res.headers).toHaveProperty("ratelimit-policy")
  })
})
