import { describe, expect, it } from "vitest"

import { excerptParts, hasMatch, searchPath } from "@/assets/search"


describe("searchPath", () => {
  it("puts the query, type and page in the address, leaving out what's absent", () => {
    expect(searchPath()).toBe("/search")
    expect(searchPath({ q: "reforma tributária" })).toBe("/search?q=reforma+tribut%C3%A1ria")
    expect(searchPath({ q: "a&b", type: "post", page: 2 })).toBe("/search?q=a%26b&type=post&p=3")
    expect(searchPath({ q: "a", page: 0 })).toBe("/search?q=a")
  })
})

describe("excerptParts", () => {
  it("splits an excerpt at the matched words", () => {
    expect(excerptParts("a semana de quatro dias e quatro")).toEqual([
      { text: "a semana de ", match: false },
      { text: "quatro", match: true },
      { text: " dias e ", match: false },
      { text: "quatro", match: true }
    ])
  })

  it("keeps markup as text", () => {
    expect(excerptParts("<b>x</b>")).toEqual([
      { text: "<b>", match: false },
      { text: "x", match: true },
      { text: "</b>", match: false }
    ])
  })

  it("is empty for no excerpt", () => {
    expect(excerptParts(undefined)).toEqual([])
    expect(excerptParts("")).toEqual([])
  })
})

describe("hasMatch", () => {
  it("tells an excerpt that matched from the start of a text", () => {
    expect(hasMatch("um termo")).toBe(true)
    expect(hasMatch("o começo do texto")).toBe(false)
    expect(hasMatch(undefined)).toBe(false)
  })
})
