import { describe, expect, it, vi } from "vitest"

import { describeNotification, markRead, UNREAD_EVENT } from "@/assets/notifications"


const API = "http://api.test"

const base = { content: { id: 5, title: "Meu post", type: "post" }, topic_id: 2, subject: null, suggestion: null }

describe("describeNotification", () => {
  it("opens a critique at the version it criticised", () => {
    const notification = { ...base, type: "critique", subject: { id: 9, title: "Crítica", type: "critique", commit: "abc123" } }

    expect(describeNotification(notification)).toEqual({
      action: "criticou seu post",
      target: "Meu post",
      path: "/topics/2/posts/5?commit=abc123&critique=9"
    })
  })

  it.each([
    ["suggestion", "sugeriu uma alteração no seu post"],
    ["suggestion_accepted", "aceitou sua sugestão para"],
    ["suggestion_rejected", "rejeitou sua sugestão para"]
  ])("leads %s to the post, with the suggestion's message", (type, action) => {
    const notification = { ...base, type, suggestion: { message: "Corrige a introdução", commit: "def456" } }

    expect(describeNotification(notification)).toEqual({ action, target: "Meu post", path: "/topics/2/posts/5", detail: "Corrige a introdução" })
  })

  it("leads a new post in a topic to the post", () => {
    const notification = { ...base, type: "post", content: { id: 2, title: "Meu tópico", type: "topic" }, subject: { id: 7, title: "Uma resposta", type: "post", commit: null } }

    expect(describeNotification(notification)).toEqual({ action: "respondeu ao seu tópico", target: "Meu tópico", path: "/topics/2/posts/7", detail: "Uma resposta" })
  })

  it("leads a clone to the new post", () => {
    const notification = { ...base, type: "clone", subject: { id: 8, title: "Minha versão", type: "post", commit: null } }

    expect(describeNotification(notification)).toMatchObject({ target: "Meu post", path: "/topics/2/posts/8", detail: "Minha versão" })
  })

  it.each([
    ["critique_addressed", "corrigiu o trecho que você criticou em"],
    ["critique_rebutted", "refutou sua crítica a"],
    ["critique_accepted", "aceitou sua resposta a uma crítica em"],
    ["critique_disputed", "contestou sua resposta a uma crítica em"],
    ["critique_withdrawn", "retirou uma crítica a"]
  ])("opens the critique answered (%s) on the post's latest version", (type, action) => {
    const notification = { ...base, type, subject: { id: 9, title: "Crítica", type: "critique", commit: "abc123" } }

    expect(describeNotification(notification)).toEqual({ action, target: "Meu post", path: "/topics/2/posts/5?critique=9", detail: "Crítica" })
  })

  it("still links a type it doesn't know (one added to the API later)", () => {
    expect(describeNotification({ ...base, type: "critique_upheld" })).toMatchObject({ target: "Meu post", path: "/topics/2/posts/5" })
  })
})

describe("markRead", () => {
  it("sends the ids, and announces the new unread count", async () => {
    const fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ read: 2, unread: 3 }) }))
    vi.stubGlobal("fetch", fetch)
    const listener = vi.fn()
    window.addEventListener(UNREAD_EVENT, listener)

    expect(await markRead([1, 2])).toBe(3)
    expect(fetch).toHaveBeenCalledWith(`${API}/notifications/read`, expect.objectContaining({ method: "POST", body: JSON.stringify({ ids: [1, 2] }) }))
    expect(listener.mock.calls[0][0].detail).toBe(3)

    window.removeEventListener(UNREAD_EVENT, listener)
  })

  it("marks all of them without ids", async () => {
    const fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ read: 4, unread: 0 }) }))
    vi.stubGlobal("fetch", fetch)

    expect(await markRead()).toBe(0)
    expect(fetch.mock.calls[0][1].body).toBe("{}")
  })
})
