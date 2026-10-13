// Prestige: what each outcome awards, to whom, and how a profile explains every point. The limits
// that hold awards back are in prestigeLimits.test.ts; here each test uses people who haven't
// earned anything from each other yet, so the default limits never come into play.
import { beforeAll, describe, expect, it } from "vitest"
import { PRESTIGE_REASONS } from "@colcom/shared"

import db from "@/pgDatabase"
import {
  act, api, createPost, createTopic, criticised, edit, interact, mergeSuggestion, prestigeOf, resolveCritique,
  signUp, TestUser, unique
} from "../support/api"


let host: TestUser

beforeAll(async () => {
  host = await signUp()
})

// Two (or more) people who haven't earned anything yet
const people = (count = 2) => Promise.all(Array.from({ length: count }, () => signUp()))

// Each award as [reason, amount], newest first
const awards = async (user: TestUser) => (await prestigeOf(user)).events.map(event => [event.reason, event.amount])

describe("resolving a critique", () => {
  it("awards the critic and the post's author when the critic accepts the author's fix", async () => {
    const [author, critic] = await people()
    const { topic, post, critiqueId } = await resolveCritique(author, critic)

    const critics = await prestigeOf(critic)
    expect(critics.prestige).toBe(10)
    expect(critics.events).toEqual([{
      id: expect.any(Number),
      reason: "critique_fixed",
      amount: 10,
      rule_amount: 10,
      limited: null,
      created_at: expect.any(String),
      counterpart: { pid: author.pid, name: author.name },
      critique: { id: critiqueId, title: expect.any(String) },
      post: { id: post.id, title: post.title },
      topic: { id: topic.id, title: topic.title },
      suggestion: null
    }])

    const authors = await prestigeOf(author)
    expect(authors.prestige).toBe(5)
    expect(authors.events).toMatchObject([{ reason: "fix_accepted", amount: 5, counterpart: { pid: critic.pid }, critique: { id: critiqueId } }])
  })

  it("awards only the post's author when the critic accepts their rebuttal", async () => {
    const [author, critic] = await people()
    await resolveCritique(author, critic, "rebut")

    expect(await awards(author)).toEqual([["rebuttal_accepted", 5]])
    expect(await awards(critic)).toEqual([])
  })

  it("awards nothing for answers not accepted, disputes or withdrawals", async () => {
    const [author, critic] = await people()

    const addressed = await criticised(author, critic)
    expect((await act(author, addressed.critiqueId, { action: "address", commit: addressed.fix })).status).toBe(201)

    const disputed = await criticised(author, critic)
    expect((await act(author, disputed.critiqueId, { action: "rebut", note: "Não procede." })).status).toBe(201)
    expect((await act(critic, disputed.critiqueId, { action: "dispute", note: "Procede, sim." })).status).toBe(201)

    const withdrawn = await criticised(author, critic)
    expect((await act(critic, withdrawn.critiqueId, { action: "withdraw" })).status).toBe(201)

    expect((await prestigeOf(author)).prestige).toBe(0)
    expect((await prestigeOf(critic)).prestige).toBe(0)
  })

  it("awards the critic, not as a suggestion, when the author merges the critic's own fix", async () => {
    const [author, critic] = await people()
    const { post, critiqueId } = await criticised(author, critic)
    const suggested = await api().patch(`/contents/${post.id}`).set(critic.auth)
      .send({ body: `<p>${unique("Fixed")}</p>`, message: "Corrige o trecho", critique: critiqueId })
    expect(suggested.status, JSON.stringify(suggested.body)).toBe(200)

    expect((await api().post(`/contents/${post.id}/${suggested.body.config.commit}/merge`).set(author.auth)).status).toBe(204)

    const critics = await prestigeOf(critic)
    expect(critics.prestige).toBe(10)
    expect(critics.events).toMatchObject([{ reason: "critique_fixed", critique: { id: critiqueId }, suggestion: { id: suggested.body.id, message: "Corrige o trecho" } }])
    expect(await awards(author)).toEqual([["suggestion_adopted", 1]])
  })

  it("awards a fix merged after its critique was withdrawn as a suggestion", async () => {
    const [author, critic] = await people()
    const { post, critiqueId } = await criticised(author, critic)
    const suggested = await api().patch(`/contents/${post.id}`).set(critic.auth)
      .send({ body: `<p>${unique("Fixed")}</p>`, message: "Corrige o trecho", critique: critiqueId })
    expect((await act(critic, critiqueId, { action: "withdraw" })).status).toBe(201)

    expect((await api().post(`/contents/${post.id}/${suggested.body.config.commit}/merge`).set(author.auth)).status).toBe(204)

    expect(await awards(critic)).toEqual([["suggestion_merged", 5]])
  })
})

describe("merging a suggestion", () => {
  it("awards whoever suggested it and the post's author who took it", async () => {
    const [author, suggester] = await people()
    const { postId, suggestionId } = await mergeSuggestion(author, suggester)

    const suggesters = await prestigeOf(suggester)
    expect(suggesters.prestige).toBe(5)
    expect(suggesters.events).toMatchObject([{
      reason: "suggestion_merged",
      amount: 5,
      counterpart: { pid: author.pid },
      critique: null,
      post: { id: postId },
      suggestion: { id: suggestionId }
    }])
    expect(await awards(author)).toEqual([["suggestion_adopted", 1]])
  })

  it("awards nothing for a rejected suggestion", async () => {
    const [author, suggester] = await people()
    const post = await createPost(author, (await createTopic(author)).id)
    const suggested = await edit(suggester, post.id, "<p>Rejected.</p>")

    expect((await api().post(`/contents/${post.id}/${suggested.body.config.commit}/reject`).set(author.auth)).status).toBe(200)

    expect((await prestigeOf(suggester)).prestige).toBe(0)
    expect((await prestigeOf(author)).prestige).toBe(0)
  })
})

describe("what doesn't earn prestige", () => {
  it("never counts votes, writing or being cloned", async () => {
    const [author, fan] = await people()
    const topic = await createTopic(author)
    const post = await createPost(author, topic.id)
    for (const type of ["up", "vote", "bookmark"])
      expect((await interact(fan, post.id, type)).status).toBe(201)
    expect((await api().post(`/contents/${post.id}/${(await api().get(`/contents/${post.id}`)).body.history[0].commit}/clone`).set(fan.auth).send({ title: unique("Clone") })).status).toBe(200)

    expect((await prestigeOf(author)).prestige).toBe(0)
    expect((await prestigeOf(fan)).prestige).toBe(0)
  })
})

describe("the ledger", () => {
  it("keeps users.prestige as the sum of a user's awards, which only awards change", async () => {
    const [author, critic] = await people()
    await resolveCritique(author, critic)
    await mergeSuggestion(host, critic)

    const { rows: [user] } = await db.query("SELECT prestige FROM users WHERE pid = $1;", [critic.pid])
    expect(user.prestige).toBe(15)
    expect((await api().get(`/users/${critic.name}`)).body.prestige).toBe(15)

    await expect(db.query("UPDATE users SET prestige = 1000 WHERE pid = $1;", [critic.pid])).rejects.toThrow(/prestige_events/)
  })

  it("can't be altered or erased", async () => {
    const [author, critic] = await people()
    await resolveCritique(author, critic)
    const userId = "(SELECT id FROM users WHERE pid = $1)"

    await expect(db.query(`UPDATE prestige_events SET amount = 1000 WHERE user_id = ${userId}`, [critic.pid])).rejects.toThrow(/append-only/)
    await expect(db.query(`DELETE FROM prestige_events WHERE user_id = ${userId}`, [critic.pid])).rejects.toThrow(/append-only/)
    await expect(db.query("TRUNCATE prestige_events")).rejects.toThrow(/append-only/)
  })

  it("keeps the amount each award was given when a rule changes", async () => {
    const [author, critic, later] = await people(3)
    await resolveCritique(author, critic)

    await db.query("UPDATE prestige_rules SET amount = 7 WHERE reason = 'critique_fixed';")
    try {
      await resolveCritique(author, later)
      expect(await awards(later)).toEqual([["critique_fixed", 7]])
      expect(await awards(critic)).toEqual([["critique_fixed", 10]])
    }
    finally {
      await db.query("UPDATE prestige_rules SET amount = 10 WHERE reason = 'critique_fixed';")
    }
  })
})

describe("GET /users/:name/prestige", () => {
  it("lists a user's awards newest first, a page at a time, with their total", async () => {
    const [author, critic] = await people()
    await resolveCritique(author, critic)
    await mergeSuggestion(host, author)
    await resolveCritique(author, critic, "rebut")

    const first = await prestigeOf(author, { pageSize: 2 })
    expect(first).toMatchObject({ prestige: 15, count: 3 })
    expect(first.events.map(event => event.reason)).toEqual(["rebuttal_accepted", "suggestion_merged"])

    const second = await prestigeOf(author, { page: 2, pageSize: 2 })
    expect(second).toMatchObject({ prestige: 15, count: 3 })
    expect(second.events.map(event => event.reason)).toEqual(["fix_accepted"])

    expect(await prestigeOf(author, { page: 9, pageSize: 2 })).toEqual({ prestige: 15, count: 3, events: [] })
  })

  it("finds the user ignoring the name's case, and 404s for no one", async () => {
    const [user] = await people(1)
    expect((await api().get(`/users/${user.name.toUpperCase()}/prestige`)).body).toEqual({ prestige: 0, count: 0, events: [] })
    expect((await api().get("/users/nobody_at_all/prestige")).status).toBe(404)
  })

  it("refuses a malformed page", async () => {
    const [user] = await people(1)
    const res = await api().get(`/users/${user.name}/prestige`).query({ page: 0 })
    expect(res.status).toBe(400)
    expect(res.body.key).toBe("page")
  })
})

describe("GET /prestige", () => {
  it("says what each rule is worth, in order, and how much can be earned", async () => {
    const res = await api().get("/prestige")

    expect(res.status).toBe(200)
    expect(res.body.rules.map((rule: { reason: string }) => rule.reason)).toEqual(PRESTIGE_REASONS)
    expect(res.body.rules).toEqual([
      { reason: "critique_fixed", amount: 10 },
      { reason: "fix_accepted", amount: 5 },
      { reason: "rebuttal_accepted", amount: 5 },
      { reason: "suggestion_merged", amount: 5 },
      { reason: "suggestion_adopted", amount: 1 }
    ])
    expect(res.body.limits).toEqual({ user: { cap: 200, window: 86_400 }, pair: { cap: 5, window: 30 * 86_400 } })
  })
})
