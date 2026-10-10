import { describe, expect, it } from "vitest"

import { describeEvent, fixableCritiques, laterVersions, suggestionState } from "@/assets/critiques"
import { groupOverlappingMarks } from "@/assets/critiqueDensity"


const history = ["a", "b", "c"].map(commit => ({ commit, subject: `version ${commit}`, date: "2026-10-01T00:00:00Z" }))

describe("laterVersions", () => {
  it("offers the versions after the criticised one, newest first", () => {
    expect(laterVersions(history, "a").map(version => version.commit)).toEqual(["c", "b"])
    expect(laterVersions(history, "c")).toEqual([])
  })

  it("offers every version for a critique made off the post's line", () => {
    expect(laterVersions(history, "elsewhere").map(version => version.commit)).toEqual(["c", "b", "a"])
  })
})

describe("fixableCritiques", () => {
  it("keeps the user's own critiques still waiting for an answer", () => {
    const critiques = [
      { id: 1, author_id: "me", status: "open" },
      { id: 2, author_id: "me", status: "in_review" },
      { id: 3, author_id: "me", status: "resolved" },
      { id: 4, author_id: "me", status: "withdrawn" },
      { id: 5, author_id: "other", status: "open" }
    ]

    expect(fixableCritiques(critiques, "me").map(critique => critique.id)).toEqual([1, 2])
  })
})

describe("a critique's thread", () => {
  it("says what each event did, and how a suggested fix stands", () => {
    expect(describeEvent({ action: "address" })).toBe("corrigiu o trecho")
    expect(describeEvent({ action: "merge" })).toBe("incorporou a correção sugerida")
    expect(describeEvent({ action: "reopen" })).toBe("atualizou a crítica")
    expect([null, true, false].map(suggestionState)).toEqual(["pendente", "incorporada", "rejeitada"])
  })
})

describe("closed critiques", () => {
  it("are left out of the highlights, keeping the others' indexes", () => {
    const critiques = [
      { anchor: { from: 1, to: 5, match: "exact" }, status: "resolved" },
      { anchor: { from: 3, to: 8, match: "exact" }, status: "open" },
      { anchor: { from: 10, to: 12, match: "exact" }, status: "withdrawn" },
      { anchor: { from: 10, to: 12, match: "exact" } }
    ]

    expect(groupOverlappingMarks(critiques).map(group => group.index)).toEqual([[1], [3]])
  })
})
