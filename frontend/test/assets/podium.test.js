import { describe, expect, it } from "vitest"

import { ordinal, periodPhrase, podiumParams, podiumPath, scoreText, votesText } from "@/assets/podium"


describe("podiumPath", () => {
  it("puts the type and period in the address, leaving the defaults out", () => {
    expect(podiumPath()).toBe("/podium")
    expect(podiumPath({ type: "topic", period: "week" })).toBe("/podium")
    expect(podiumPath({ type: "post" })).toBe("/podium?type=post")
    expect(podiumPath({ period: "month" })).toBe("/podium?period=month")
    expect(podiumPath({ type: "post", period: "all" })).toBe("/podium?type=post&period=all")
  })

  it("is read back by podiumParams, which takes anything unknown as the default", () => {
    const read = path => podiumParams(new URL(path, "http://colcom.test").searchParams)

    expect(read(podiumPath({ type: "post", period: "month" }))).toEqual({ type: "post", period: "month" })
    expect(read("/podium")).toEqual({ type: "topic", period: "week" })
    expect(read("/podium?type=critique&period=year")).toEqual({ type: "topic", period: "week" })
  })
})

describe("the rule's words", () => {
  it("say when the counted votes were cast, by the API's periods", () => {
    expect(periodPhrase("week")).toBe("nos últimos 7 dias")
    expect(periodPhrase("month")).toBe("nos últimos 30 dias")
    expect(periodPhrase("all")).toBe("desde o início")
  })

  it("say each position and what its score is made of", () => {
    expect(ordinal(1)).toBe("1º")
    expect(scoreText(5)).toBe("+5")
    expect(votesText({ upvotes: 3, downvotes: 1 })).toBe("3 acharam relevante, 1 não")
    expect(votesText({ upvotes: 1, downvotes: 0 })).toBe("1 achou relevante, 0 não")
  })
})
