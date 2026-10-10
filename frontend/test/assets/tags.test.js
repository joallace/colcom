import { describe, expect, it } from "vitest"

import { tagPath, tagSlug, tagsFromPath, toggleTag } from "@/assets/tags"


describe("tag paths", () => {
  it("join slugs with +, and split them back", () => {
    expect(tagPath(["politica", "eua", "texas"])).toBe("/t/politica+eua+texas")
    expect(tagsFromPath("politica+eua")).toEqual(["politica", "eua"])
    expect(tagsFromPath(undefined)).toEqual([])
  })

  it("add a tag to a set, or remove it when it's there", () => {
    expect(toggleTag(["a", "b"], "c")).toEqual(["a", "b", "c"])
    expect(toggleTag(["a", "b"], "a")).toEqual(["b"])
  })

  it("use the shared slug, so the frontend previews what the API stores", () => {
    expect(tagSlug("São Paulo")).toBe("sao-paulo")
  })
})
