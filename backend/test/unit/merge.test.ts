// The three-way merge (shared/src/merge.js) the backend falls back on when git refuses a suggestion,
// and the frontend shows the conflicts of
import { describe, expect, it } from "vitest"
import { cleanMerge, diffLines, merge3, splitLines } from "@colcom/shared"


// A document of one block per line, as formatHtml stores it
const doc = (...blocks: string[]) => blocks.map(block => `<p>${block}</p>\n`).join("")

describe("merge3", () => {
  it("merges changes to paragraphs next to each other, which git counts as a conflict", () => {
    const base = doc("a", "b", "c")

    expect(merge3(base, doc("a", "B", "c"), doc("a", "b", "new", "c"))).toEqual([{ type: "ok", text: doc("a", "B", "new", "c") }])
    expect(merge3(base, doc("a", "B", "c"), doc("a", "new", "b", "c"))).toEqual([{ type: "ok", text: doc("a", "new", "B", "c") }])
    expect(merge3(base, doc("A", "b", "c"), doc("a", "B", "c"))).toEqual([{ type: "ok", text: doc("A", "B", "c") }])
  })

  it("takes a change both sides made once", () => {
    expect(merge3(doc("a", "b"), doc("a", "X"), doc("a", "X"))).toEqual([{ type: "ok", text: doc("a", "X") }])
  })

  it("reports changes to the same lines as a conflict, between what's merged", () => {
    expect(merge3(doc("a", "b", "c", "d", "e"), doc("A", "b", "c1", "d", "e"), doc("a", "b", "c2", "d", "E"))).toEqual([
      { type: "ok", text: doc("A", "b") },
      { type: "conflict", base: doc("c"), ours: doc("c1"), theirs: doc("c2") },
      { type: "ok", text: doc("d", "E") }
    ])
  })

  it("reports different paragraphs added at the same place, and a removal against an edit", () => {
    expect(merge3(doc("a", "b"), doc("a", "x", "b"), doc("a", "y", "b"))[1])
      .toEqual({ type: "conflict", base: "", ours: doc("x"), theirs: doc("y") })
    expect(merge3(doc("a", "b", "c"), doc("a", "c"), doc("a", "B", "c"))[1])
      .toEqual({ type: "conflict", base: doc("b"), ours: "", theirs: doc("B") })
  })

  it("groups changes that overlap through others into one conflict", () => {
    const chunks = merge3(doc("a", "b", "c", "d"), doc("A", "B", "c", "d"), doc("a", "b2", "c2", "d"))

    expect(chunks).toEqual([
      { type: "conflict", base: doc("a", "b", "c"), ours: doc("A", "B", "c"), theirs: doc("a", "b2", "c2") },
      { type: "ok", text: doc("d") }
    ])
  })

  it("gives either side back when the other is unchanged", () => {
    for (let i = 0; i < 500; i++) {
      const random = () => Array.from({ length: Math.floor(Math.random() * 10) }, () => doc("abc"[Math.floor(Math.random() * 3)])).join("")
      const [base, changed] = [random(), random()]

      expect(cleanMerge(base, base, changed)).toBe(changed)
      expect(cleanMerge(base, changed, base)).toBe(changed)
    }
  })

  it("keeps text without a final line break", () => {
    expect(cleanMerge("<p>a</p>\n<p>b</p>", "<p>A</p>\n<p>b</p>", "<p>a</p>\n<p>b</p>")).toBe("<p>A</p>\n<p>b</p>")
  })

  it("merges long documents quickly", () => {
    const base = Array.from({ length: 3000 }, (_, i) => doc(String(i))).join("")
    const ours = base.replace(/<p>(\d*0)<\/p>/g, "<p>$1 by the author</p>")
    const theirs = base.replace(/<p>(\d*5)<\/p>/g, "<p>$1 suggested</p>")
    const start = performance.now()

    const merged = cleanMerge(base, ours, theirs)

    expect(performance.now() - start).toBeLessThan(1000)
    expect(merged).toContain("<p>10 by the author</p>\n<p>11</p>")
    expect(merged).toContain("<p>15 suggested</p>")
  })
})

describe("diffLines", () => {
  it("finds the fewest lines to change", () => {
    const [a, b] = [splitLines(doc("a", "b", "c", "a", "b", "b", "a")), splitLines(doc("c", "b", "a", "b", "a", "c"))]

    const removed = diffLines(a, b).reduce((sum, hunk) => sum + hunk.end - hunk.start, 0)

    // Their longest common subsequence has 4 lines
    expect(a.length - removed).toBe(4)
  })

  it("compares versions changed throughout as one block", () => {
    const a = Array.from({ length: 1500 }, (_, i) => `a${i}\n`)
    const b = Array.from({ length: 1500 }, (_, i) => `b${i}\n`)

    expect(diffLines(a, b)).toEqual([{ start: 0, end: 1500, lines: b }])
  })
})
