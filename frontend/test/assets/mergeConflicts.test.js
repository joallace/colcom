import { describe, expect, it } from "vitest"

import { conflictContexts, conflictsOf, mergeChunks, resolveChunks } from "@/assets/mergeConflicts"


// As the API sends documents: one block per line
const doc = (...blocks) => blocks.map(block => `<p>${block}</p>\n`).join("")

const SIDES = {
  base: { commit: "b".repeat(40), body: doc("Intro.", "Taxes should fall.", "Spending must be reviewed.", "End.") },
  head: { commit: "h".repeat(40), body: doc("A new intro.", "Taxes should fall for everyone.", "Spending must be reviewed.", "End.") },
  suggestion: { commit: "s".repeat(40), body: doc("Intro.", "Taxes should fall a little.", "Spending must be reviewed.", "End!") }
}

describe("mergeChunks", () => {
  it("merges what one side changed and keeps what both changed as conflicts", () => {
    const chunks = mergeChunks(SIDES)

    expect(conflictsOf(chunks)).toEqual([
      { type: "conflict", base: doc("Intro.", "Taxes should fall."), ours: doc("A new intro.", "Taxes should fall for everyone."), theirs: doc("Intro.", "Taxes should fall a little.") }
    ])
  })
})

describe("resolveChunks", () => {
  const chunks = mergeChunks(SIDES)
  const rest = doc("Spending must be reviewed.", "End!")

  it.each([
    ["ours", doc("A new intro.", "Taxes should fall for everyone.") + rest],
    ["theirs", doc("Intro.", "Taxes should fall a little.") + rest],
    ["both", doc("A new intro.", "Taxes should fall for everyone.", "Intro.", "Taxes should fall a little.") + rest]
  ])("keeps %s", (choice, expected) => {
    expect(resolveChunks(chunks, [choice])).toBe(expected)
  })
})

describe("conflictContexts", () => {
  it("gives the text of the blocks around each conflict", () => {
    const base = doc("One.", "Two.", "Three.", "Four.", "Five.")
    const chunks = mergeChunks({
      base: { body: base },
      head: { body: doc("One!", "Two.", "Three!", "Four.", "Five.") },
      suggestion: { body: doc("One?", "Two.", "Three?", "Four.", "<strong>Five</strong>.") }
    })

    expect(conflictContexts(chunks)).toEqual([{ before: "", after: "Two." }, { before: "Two.", after: "Four." }])
  })

  it("never runs what it reads", () => {
    const chunks = [
      { type: "ok", text: '<p><img src="x" onerror="window.ran = true">Before.</p>\n' },
      { type: "conflict", base: "", ours: doc("a"), theirs: doc("b") }
    ]

    expect(conflictContexts(chunks)).toEqual([{ before: "Before.", after: "" }])
    expect(window.ran).toBeUndefined()
  })
})
