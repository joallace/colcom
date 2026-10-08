import { describe, expect, it, vi } from "vitest"

import { clearDraft, loadDraft, saveDraft } from "@/assets/drafts"


describe("drafts", () => {
  it("keeps each topic's draft apart", () => {
    saveDraft(1, "title", "One")
    saveDraft(1, "body", "<p>one</p>")
    saveDraft(2, "body", "<p>two</p>")

    expect(loadDraft(1)).toEqual({ title: "One", body: "<p>one</p>" })
    expect(loadDraft(2)).toEqual({ title: "", body: "<p>two</p>" })
    expect(loadDraft(3)).toEqual({ title: "", body: "" })

    clearDraft(1)
    expect(loadDraft(1)).toEqual({ title: "", body: "" })
    expect(loadDraft(2).body).toBe("<p>two</p>")
  })

  it("works without storage", () => {
    const blocked = () => { throw new DOMException("blocked", "SecurityError") }
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(blocked)
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(blocked)
    vi.spyOn(Storage.prototype, "removeItem").mockImplementation(blocked)

    expect(() => saveDraft(1, "title", "One")).not.toThrow()
    expect(loadDraft(1)).toEqual({ title: "", body: "" })
    expect(() => clearDraft(1)).not.toThrow()
  })
})
