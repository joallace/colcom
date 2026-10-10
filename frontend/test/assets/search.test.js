import { describe, expect, it } from "vitest"

import { excerptParts, hasMatch, hashtagAt, searchPath, splitQuery, tagsFromSearch } from "@/assets/search"


describe("searchPath", () => {
  it("puts the query, tags, type and page in the address, leaving out what's absent", () => {
    expect(searchPath()).toBe("/search")
    expect(searchPath({ q: "reforma tributária" })).toBe("/search?q=reforma+tribut%C3%A1ria")
    expect(searchPath({ q: "a&b", type: "post", page: 2 })).toBe("/search?q=a%26b&type=post&p=3")
    expect(searchPath({ q: "a", page: 0 })).toBe("/search?q=a")
    expect(searchPath({ tags: ["politica", "meio-ambiente"] })).toBe("/search?tags=politica%2Cmeio-ambiente")
  })

  it("is read back by tagsFromSearch", () => {
    expect(tagsFromSearch("politica,meio-ambiente")).toEqual(["politica", "meio-ambiente"])
    expect(tagsFromSearch(null)).toEqual([])
  })
})

describe("hashtagAt", () => {
  it("finds the #word the caret is in or right after", () => {
    expect(hashtagAt("#pol", 4)).toEqual({ start: 0, end: 4, query: "pol" })
    expect(hashtagAt("salário #eco mínimo", 10)).toEqual({ start: 8, end: 12, query: "eco" })
    expect(hashtagAt("a #", 3)).toEqual({ start: 2, end: 3, query: "" })
  })

  it("is null elsewhere", () => {
    expect(hashtagAt("salário #eco mínimo", 3)).toBeNull()
    expect(hashtagAt("#eco mínimo", 5)).toBeNull()
    expect(hashtagAt("a#b", 3)).toBeNull()
    expect(hashtagAt("", 0)).toBeNull()
  })
})

describe("splitQuery", () => {
  it("tells words from #tags, which become slugs", () => {
    expect(splitQuery("  salário #Política  mínimo #meio-ambiente ")).toEqual({ q: "salário mínimo", tags: ["politica", "meio-ambiente"] })
  })

  it("drops a lone # and repeated tags", () => {
    expect(splitQuery("# a #x #X")).toEqual({ q: "a", tags: ["x"] })
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
