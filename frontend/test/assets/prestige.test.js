import { describe, expect, it } from "vitest"
import { PRESTIGE_REASONS } from "@colcom/shared"

import { amountText, describePrestige, limitSentences, PRESTIGE_RULES, windowPhrase } from "@/assets/prestige"


const event = (extra = {}) => ({
  id: 1,
  reason: "critique_fixed",
  amount: 10,
  rule_amount: 10,
  limited: null,
  created_at: "2026-10-01T00:00:00.000Z",
  counterpart: { pid: "pid-bia", name: "bia" },
  critique: { id: 30, title: "Falta a fonte" },
  post: { id: 20, title: "A favor" },
  topic: { id: 10, title: "Semana de quatro dias" },
  suggestion: null,
  ...extra
})

describe("prestige", () => {
  it("has words for every reason the API awards", () => {
    for (const reason of PRESTIGE_REASONS)
      expect(PRESTIGE_RULES[reason]).toEqual({ label: expect.any(String), rule: expect.any(String), by: expect.any(String) })
    expect(Object.keys(PRESTIGE_RULES)).toEqual(PRESTIGE_REASONS)
  })

  it("writes amounts with their sign", () => {
    expect(amountText(10)).toBe("+10")
    expect(amountText(0)).toBe("+0")
    expect(amountText(-5)).toBe("−5")
  })

  it.each([
    [86_400, "por dia"],
    [30 * 86_400, "a cada 30 dias"],
    [3_600, "por hora"],
    [12 * 3_600, "a cada 12 horas"],
    [15 * 60, "a cada 15 minutos"],
    [90, "a cada 90 segundos"]
  ])("says a window of %i seconds as %j", (seconds, phrase) => {
    expect(windowPhrase(seconds)).toBe(phrase)
  })

  it("says each limit in a sentence, and none when they're lifted", () => {
    expect(limitSentences({ user: { cap: 200, window: 86_400 }, pair: { cap: 5, window: 30 * 86_400 } })).toEqual([
      "Ninguém ganha mais de 200 de prestígio por dia.",
      "Ninguém recebe mais de 5 prêmios da mesma pessoa a cada 30 dias."
    ])
    expect(limitSentences({ user: null, pair: { cap: 1, window: 86_400 } })).toEqual(["Ninguém recebe mais de 1 prêmio da mesma pessoa por dia."])
    expect(limitSentences({ user: null, pair: null })).toEqual([])
  })

  it("describes an award for a critique, leading to it on its post", () => {
    expect(describePrestige(event())).toEqual({
      label: "crítica que levou a uma correção",
      target: "Falta a fonte",
      path: "/topics/10/posts/20?critique=30",
      context: "A favor",
      by: "corrigida por",
      held: null
    })
  })

  it("describes an award for a suggestion, leading to its post", () => {
    const merged = event({ reason: "suggestion_merged", critique: null, suggestion: { id: 7, message: "Corrige a data" } })

    expect(describePrestige(merged)).toMatchObject({
      label: "sugestão incorporada",
      target: "A favor",
      path: "/topics/10/posts/20",
      context: "Corrige a data",
      by: "incorporada por"
    })
  })

  it("says what held an award back", () => {
    expect(describePrestige(event({ amount: 0, limited: "pair" })).held).toBe("0 de 10 creditados: limite de prêmios da mesma pessoa")
    expect(describePrestige(event({ amount: 4, limited: "user" })).held).toBe("4 de 10 creditados: limite de prestígio por período")
  })

  it("still describes an award it has no words for, or one confirmed by no one", () => {
    expect(describePrestige(event({ reason: "jury_duty", counterpart: null, critique: null, post: null, topic: null }))).toEqual({
      label: "jury_duty", target: null, path: null, context: undefined, by: null, held: null
    })
  })
})
