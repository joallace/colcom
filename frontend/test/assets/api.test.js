import { describe, expect, it, onTestFinished, vi } from "vitest"

import api, { ApiError, SESSION_ENDED_EVENT } from "@/assets/api"


const API = "http://api.test"

// What an empty body answers to `json()`
const EMPTY = Symbol("empty")

// Answers every request with `status` and `body`
const mockFetch = (status = 200, body = {}) => {
  const fetch = vi.fn(async () => ({
    ok: status < 400,
    status,
    json: async () => {
      if (body === EMPTY)
        throw new SyntaxError("Unexpected end of JSON input")
      return body
    }
  }))
  vi.stubGlobal("fetch", fetch)
  return fetch
}

const listenForLogout = () => {
  const listener = vi.fn()
  window.addEventListener(SESSION_ENDED_EVENT, listener)
  onTestFinished(() => window.removeEventListener(SESSION_ENDED_EVENT, listener))
  return listener
}

describe("api", () => {
  it("prefixes the API's address and sends the stored token", async () => {
    localStorage.setItem("accessToken", "token-1")
    const fetch = mockFetch(200, { id: 1 })

    expect(await api.get("/contents/1")).toEqual({ id: 1 })
    expect(fetch).toHaveBeenCalledWith(`${API}/contents/1`, { method: "GET", headers: { Authorization: "Bearer token-1" } })
  })

  it("sends no token when there's none", async () => {
    const fetch = mockFetch()

    await api.get("/topics")

    expect(fetch.mock.calls[0][1].headers).toEqual({})
  })

  it("sends a body as JSON", async () => {
    localStorage.setItem("accessToken", "token-1")
    const fetch = mockFetch(201, { id: 2 })

    expect(await api.post("/contents", { title: "Título" })).toEqual({ id: 2 })
    expect(fetch).toHaveBeenCalledWith(`${API}/contents`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token-1" },
      body: JSON.stringify({ title: "Título" })
    })
  })

  it("patches", async () => {
    const fetch = mockFetch()

    await api.patch("/contents/1", { body: "<p>x</p>" })

    expect(fetch.mock.calls[0][1]).toMatchObject({ method: "PATCH", body: JSON.stringify({ body: "<p>x</p>" }) })
  })

  it("answers undefined for a 204 or an empty body", async () => {
    mockFetch(204, EMPTY)
    expect(await api.post("/logout")).toBeUndefined()

    mockFetch(200, EMPTY)
    expect(await api.get("/empty")).toBeUndefined()
  })

  it("passes a signal and other options on to fetch", async () => {
    const fetch = mockFetch()
    const controller = new AbortController()

    await api.post("/notifications/read", {}, { signal: controller.signal, keepalive: true })

    expect(fetch.mock.calls[0][1]).toMatchObject({ signal: controller.signal, keepalive: true })
  })

  it("sends a given token instead of the stored one, or none with auth: false", async () => {
    localStorage.setItem("accessToken", "stored")
    const fetch = mockFetch()

    await api.post("/logout", undefined, { token: "given" })
    await api.post("/login", { login: "a", pass: "b" }, { auth: false })

    expect(fetch.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer given" })
    expect(fetch.mock.calls[1][1].headers).toEqual({ "Content-Type": "application/json" })
  })

  it("throws an ApiError with the status and the API's error body", async () => {
    const body = {
      name: "ValidationError",
      message: "Título: máximo de 150 caracteres.",
      action: "Corrija os campos.",
      key: "title",
      errors: [{ key: "title", label: "Título", message: "máximo de 150 caracteres" }],
      errorLocationCode: "SOME:CODE"
    }
    mockFetch(400, body)

    const error = await api.post("/contents", {}).catch(err => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({
      status: 400,
      message: body.message,
      action: body.action,
      key: "title",
      errors: body.errors,
      errorLocationCode: "SOME:CODE",
      data: body
    })
  })

  it("throws an ApiError even when the refusal has no body", async () => {
    mockFetch(502, EMPTY)

    const error = await api.get("/topics").catch(err => err)

    expect(error).toBeInstanceOf(ApiError)
    expect(error.status).toBe(502)
    expect(error.data).toEqual({})
  })

  it("lets a failed connection's error through", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch") }))

    await expect(api.get("/topics")).rejects.toThrow(TypeError)
  })
})

describe("a refused token", () => {
  it("announces the session's end on a 401 for a request that sent the stored token", async () => {
    const listener = listenForLogout()
    localStorage.setItem("accessToken", "revoked")
    mockFetch(401, { message: "Sessão encerrada." })

    await expect(api.get("/users/self")).rejects.toMatchObject({ status: 401 })
    expect(listener).toHaveBeenCalledTimes(1)
  })

  it("doesn't on a 401 to a request without a token, like a wrong password", async () => {
    const listener = listenForLogout()
    mockFetch(401, { message: "Dados não conferem." })

    await expect(api.post("/login", { login: "a", pass: "wrong" }, { auth: false })).rejects.toMatchObject({ status: 401 })
    expect(listener).not.toHaveBeenCalled()
  })

  it("doesn't when logging in while a token is stored", async () => {
    const listener = listenForLogout()
    localStorage.setItem("accessToken", "valid")
    mockFetch(401, { message: "Dados não conferem." })

    await expect(api.post("/login", { login: "a", pass: "wrong" }, { auth: false })).rejects.toBeInstanceOf(ApiError)
    expect(listener).not.toHaveBeenCalled()
  })

  it("doesn't when the token was replaced while the request was on its way", async () => {
    const listener = listenForLogout()
    localStorage.setItem("accessToken", "old")
    vi.stubGlobal("fetch", vi.fn(async () => {
      // Logged in again meanwhile
      localStorage.setItem("accessToken", "new")
      return { ok: false, status: 401, json: async () => ({ message: "Sessão encerrada." }) }
    }))

    await expect(api.get("/topics")).rejects.toBeInstanceOf(ApiError)
    expect(listener).not.toHaveBeenCalled()
  })

  it("doesn't on other refusals", async () => {
    const listener = listenForLogout()
    localStorage.setItem("accessToken", "valid")
    mockFetch(403, { message: "Proibido." })

    await expect(api.get("/contents/1/abc/merge")).rejects.toMatchObject({ status: 403 })
    expect(listener).not.toHaveBeenCalled()
  })
})
