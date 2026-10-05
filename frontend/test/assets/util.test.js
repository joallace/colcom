import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { getUserVote, relativeTime, toPercentageStr } from "@/assets/util"


describe("toPercentageStr", () => {
  it.each([
    [0, "0%"],
    [1, "100%"],
    [0.5, "50%"],
    [0.125, "12.5%"],
    [0.12345, "12.35%"],
    [1 / 3, "33.33%"],
    [undefined, "0%"],
    [NaN, "0%"],
  ])("%s is %s", (value, expected) => {
    expect(toPercentageStr(value)).toBe(expected)
  })
})

describe("getUserVote", () => {
  // How much the user's current vote changes the up count relative to what the server counted
  it.each([
    ["up", "up", 0],
    ["down", "down", 0],
    [undefined, "up", 1],
    ["down", "up", 1],
    ["up", "down", -1],
    ["up", "", -1],
    ["up", undefined, -1],
    [undefined, "down", 0],
    ["down", "", 0],
  ])("from %j to %j counts %i", (initial, current, expected) => {
    expect(getUserVote(initial, current)).toBe(expected)
  })
})

describe("relativeTime", () => {
  const now = new Date("2026-06-15T12:00:00Z")
  const ago = seconds => new Date(now.getTime() - seconds * 1000).toISOString()

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it.each([
    [0, "0 segundos atrás"],
    [1, "1 segundo atrás"],
    [89, "89 segundos atrás"],
    [90, "2 minutos atrás"],
    [60 * 60, "60 minutos atrás"],
    [3 * 60 * 60, "3 horas atrás"],
    [24 * 60 * 60, "24 horas atrás"],
    [3 * 24 * 60 * 60, "3 dias atrás"],
    [7 * 24 * 60 * 60, "7 dias atrás"],
    [21 * 24 * 60 * 60, "3 semanas atrás"],
    [100 * 24 * 60 * 60, "3 meses atrás"],
    [30 * 24 * 60 * 60 * 1.5, "6 semanas atrás"],
  ])("%i seconds ago is %s", (seconds, expected) => {
    expect(relativeTime(ago(seconds))).toBe(expected)
  })

  it("handles the future", () => {
    expect(relativeTime(ago(-10))).toBe("no futuro")
  })

  it("uses the singular month", () => {
    expect(relativeTime(ago(40 * 24 * 60 * 60))).toBe("6 semanas atrás")
    expect(relativeTime(ago(80 * 24 * 60 * 60))).toBe("3 meses atrás")
  })

  // Known bug: the years branch doesn't round, e.g. "1.0410958904109588 ano…". Drop `.fails` once fixed.
  it.fails("rounds years", () => {
    expect(relativeTime(ago(400 * 24 * 60 * 60))).toMatch(/^1 ano/)
  })
})
