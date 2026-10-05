import { describe, expect, it } from "vitest"

import { CRITIQUE_LEVELS, critiqueLevel, densitySegments, groupOverlappingMarks } from "@/assets/critiqueDensity"


describe("critiqueLevel", () => {
  it.each([
    [1, 1], [2, 2], [3, 3], [4, 3], [5, 4], [8, 4], [9, 5], [16, 5], [1000, 5]
  ])("%i critiques are level %i", (count, level) => {
    expect(critiqueLevel(count)).toBe(level)
  })

  it("has a label for every level", () => {
    expect(CRITIQUE_LEVELS).toEqual(["1", "2", "3–4", "5–8", "9+"])
  })
})

describe("densitySegments", () => {
  it("splits overlapping marks at every boundary, counting the marks over each piece", () => {
    const segments = densitySegments([
      { from: 0, to: 10, match: "exact" },
      { from: 5, to: 15, match: "exact" },
    ])

    expect(segments).toEqual([
      { from: 0, to: 5, level: 1, changed: false },
      { from: 5, to: 10, level: 2, changed: false },
      { from: 10, to: 15, level: 1, changed: false },
    ])
  })

  it("marks pieces covered by an edited passage as changed", () => {
    const segments = densitySegments([
      { from: 0, to: 10, match: "fuzzy" },
      { from: 5, to: 15, match: "exact" },
    ])

    expect(segments.map(segment => segment.changed)).toEqual([true, true, false])
  })

  it("leaves gaps between marks out", () => {
    const segments = densitySegments([{ from: 0, to: 2 }, { from: 4, to: 6 }])
    expect(segments.map(({ from, to }) => [from, to])).toEqual([[0, 2], [4, 6]])
  })

  it("counts identical marks together", () => {
    const marks = Array.from({ length: 5 }, () => ({ from: 3, to: 7 }))
    expect(densitySegments(marks)).toEqual([{ from: 3, to: 7, level: 4, changed: false }])
  })

  it("is empty without marks", () => {
    expect(densitySegments([])).toEqual([])
  })
})

describe("groupOverlappingMarks", () => {
  const critique = (from, to, match = "exact") => ({ anchor: { from, to, match } })

  it("groups overlapping critiques, keeping their indexes, and leaves separate ones apart", () => {
    const groups = groupOverlappingMarks([critique(20, 30), critique(0, 10), critique(5, 12), critique(40, 45)])

    expect(groups.map(({ from, to, index }) => ({ from, to, index }))).toEqual([
      { from: 0, to: 12, index: [1, 2] },
      { from: 20, to: 30, index: [0] },
      { from: 40, to: 45, index: [3] },
    ])
  })

  it("chains overlaps into one group", () => {
    const groups = groupOverlappingMarks([critique(0, 5), critique(4, 9), critique(8, 12)])
    expect(groups).toHaveLength(1)
    expect(groups[0]).toMatchObject({ from: 0, to: 12, index: [0, 1, 2] })
  })

  it("keeps critiques that only touch apart", () => {
    expect(groupOverlappingMarks([critique(0, 5), critique(5, 9)])).toHaveLength(2)
  })

  it("skips removed critiques but keeps the others' indexes", () => {
    const groups = groupOverlappingMarks([{ anchor: { match: "removed" } }, critique(3, 6)])
    expect(groups).toEqual([{ from: 3, to: 6, index: [1], segments: [{ from: 3, to: 6, level: 1, type: "definitive" }] }])
  })

  it("shades each group's segments and marks changed ones", () => {
    const [group] = groupOverlappingMarks([critique(0, 10, "fuzzy"), critique(5, 10)])

    expect(group.segments).toEqual([
      { from: 0, to: 5, level: 1, type: "changed" },
      { from: 5, to: 10, level: 2, type: "changed" },
    ])
  })
})
