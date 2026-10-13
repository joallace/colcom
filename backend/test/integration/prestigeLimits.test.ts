// The limits on how much prestige can be earned, so accounts can't farm it from each other. The
// backend writes them from .env at every start (Prestige.applyLimits); here each test sets the ones
// it needs with SQL, and they hold for every award in the file's database.
import { describe, expect, it } from "vitest"

import db from "@/pgDatabase"
import Prestige from "@/models/prestige"
import { api, prestigeOf, resolveCritique, signUp, TestUser } from "../support/api"


const DAY = 86_400

const setLimit = (name: "user" | "pair", cap: number | null, window = DAY) =>
  db.query("UPDATE prestige_limits SET cap = $2, window_seconds = $3 WHERE name = $1;", [name, cap, window])

const people = (count: number) => Promise.all(Array.from({ length: count }, () => signUp()))

// Each award as [reason, amount, what held it back], oldest first
const awards = async (user: TestUser) =>
  (await prestigeOf(user)).events.reverse().map(event => [event.reason, event.amount, event.limited])

// As if `earner` had been awarded `amount` `days` ago, confirmed by `counterpart`
const earnedFrom = (earner: TestUser, counterpart: TestUser, amount: number, days: number) =>
  db.query(`
    INSERT INTO prestige_events (user_id, reason, amount, rule_amount, counterpart_id, created_at)
    SELECT earner.id, 'critique_fixed', $3, $3, counterpart.id, now() - make_interval(days => $4)
    FROM users AS earner, users AS counterpart
    WHERE earner.pid = $1 AND counterpart.pid = $2;
  `, [earner.pid, counterpart.pid, amount, days])

describe("the pair limit", () => {
  it("credits nothing once someone had its awards from the same person, and says so", async () => {
    await setLimit("user", null)
    await setLimit("pair", 2, 30 * DAY)
    const [author, critic, other] = await people(3)

    for (let i = 0; i < 3; i++)
      await resolveCritique(author, critic)
    await resolveCritique(other, critic)

    expect(await awards(critic)).toEqual([
      ["critique_fixed", 10, null],
      ["critique_fixed", 10, null],
      ["critique_fixed", 0, "pair"],
      // Someone else's confirmation counts apart
      ["critique_fixed", 10, null]
    ])
    expect((await prestigeOf(critic)).events[1]).toMatchObject({ amount: 0, rule_amount: 10, limited: "pair" })
    expect((await prestigeOf(critic)).prestige).toBe(30)
    // Each way counts on its own: the author earned from the critic as many times
    expect(await awards(author)).toEqual([["fix_accepted", 5, null], ["fix_accepted", 5, null], ["fix_accepted", 0, "pair"]])
  })

  it("counts only the awards in its window", async () => {
    await setLimit("user", null)
    await setLimit("pair", 1, 30 * DAY)
    const [author, critic] = await people(2)
    await earnedFrom(critic, author, 10, 31)

    await resolveCritique(author, critic)

    expect(await awards(critic)).toEqual([["critique_fixed", 10, null], ["critique_fixed", 10, null]])
  })
})

describe("an award held back", () => {
  it("is still told, with what held it back", async () => {
    await setLimit("user", null)
    await setLimit("pair", 1, 30 * DAY)
    const [author, critic] = await people(2)

    await resolveCritique(author, critic)
    await resolveCritique(author, critic)

    const { notifications } = (await api().get("/notifications").set(critic.auth)).body
    const awards = notifications.filter((notification: { type: string }) => notification.type === "prestige")
    expect(awards.map((notification: { prestige: object }) => notification.prestige)).toEqual([
      { reason: "critique_fixed", amount: 0, rule_amount: 10, limited: "pair" },
      { reason: "critique_fixed", amount: 10, rule_amount: 10, limited: null }
    ])
  })
})

describe("the user limit", () => {
  it("credits only what's left of it in its window, and says so", async () => {
    await setLimit("pair", null)
    await setLimit("user", 25)
    const [critic, ...authors] = await people(5)

    for (const author of authors)
      await resolveCritique(author, critic)

    expect(await awards(critic)).toEqual([
      ["critique_fixed", 10, null],
      ["critique_fixed", 10, null],
      ["critique_fixed", 5, "user"],
      ["critique_fixed", 0, "user"]
    ])
    expect((await prestigeOf(critic)).prestige).toBe(25)
    // The authors' own limits are theirs
    expect((await prestigeOf(authors[3])).prestige).toBe(5)
  })

  it("counts only what was earned in its window", async () => {
    await setLimit("pair", null)
    await setLimit("user", 10)
    const [author, critic, earlier] = await people(3)
    await earnedFrom(critic, earlier, 10, 2)

    await resolveCritique(author, critic)

    expect((await prestigeOf(critic)).prestige).toBe(20)
  })
})

describe("lifted limits", () => {
  it("credit every award in full", async () => {
    await setLimit("pair", null)
    await setLimit("user", null)
    const [author, critic] = await people(2)
    await earnedFrom(critic, author, 1000, 0)

    for (let i = 0; i < 3; i++)
      await resolveCritique(author, critic)

    expect((await prestigeOf(critic)).prestige).toBe(1030)
  })
})

describe("the settings", () => {
  it("are written where the awards read them, and GET /prestige shows them", async () => {
    await Prestige.applyLimits({ user: { max: 7, windowMs: 3_600_000 }, pair: null })
    expect((await api().get("/prestige")).body.limits).toEqual({ user: { cap: 7, window: 3600 }, pair: null })

    await Prestige.applyLimits({ user: null, pair: { max: 3, windowMs: 7 * DAY * 1000 } })
    expect((await api().get("/prestige")).body.limits).toEqual({ user: null, pair: { cap: 3, window: 7 * DAY } })
  })
})
