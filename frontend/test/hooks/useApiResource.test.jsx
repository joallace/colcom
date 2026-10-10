import { act, renderHook, waitFor } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"

import { ApiError } from "@/assets/api"
import useApiResource from "@/hooks/useApiResource"


const API = "http://api.test"

// Each request waits until the test answers it, so the order of answers can be chosen
const deferredFetch = () => {
  const pending = []
  const fetch = vi.fn((url, options) => new Promise((resolve, reject) => {
    options.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")))
    pending.push({ url, options, resolve })
  }))
  vi.stubGlobal("fetch", fetch)

  const answer = async (url, body, status = 200) => {
    const request = pending.find(request => request.url === `${API}${url}`)
    await act(async () => request.resolve({ ok: status < 400, status, json: async () => body }))
  }
  return { fetch, pending, answer }
}

describe("useApiResource", () => {
  it("loads the path, sending the stored token", async () => {
    localStorage.setItem("accessToken", "token-1")
    const { fetch, answer } = deferredFetch()
    const { result } = renderHook(() => useApiResource("/topics/1"))

    expect(result.current).toMatchObject({ isLoading: true, data: undefined, error: undefined })
    await answer("/topics/1", { id: 1 })

    expect(result.current).toMatchObject({ isLoading: false, data: { id: 1 }, error: undefined })
    expect(fetch.mock.calls[0][1].headers).toEqual({ Authorization: "Bearer token-1" })
  })

  it("gives the refusal as an ApiError", async () => {
    const { answer } = deferredFetch()
    const { result } = renderHook(() => useApiResource("/topics/9"))

    await answer("/topics/9", { message: "Não encontrado." }, 404)

    expect(result.current.isLoading).toBe(false)
    expect(result.current.data).toBeUndefined()
    expect(result.current.error).toBeInstanceOf(ApiError)
    expect(result.current.error.status).toBe(404)
  })

  it("logs a failed connection and gives its error", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch") }))
    const log = vi.spyOn(console, "error").mockImplementation(() => { })
    const { result } = renderHook(() => useApiResource("/topics"))

    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.error).toBeInstanceOf(TypeError)
    expect(log).toHaveBeenCalled()
  })

  it("waits while the path is null", () => {
    const { fetch } = deferredFetch()
    const { result } = renderHook(() => useApiResource(null))

    expect(result.current.isLoading).toBe(true)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("is loading again, without the previous data, as soon as the path changes", async () => {
    const { answer } = deferredFetch()
    const { result, rerender } = renderHook(({ path }) => useApiResource(path), { initialProps: { path: "/a" } })
    await answer("/a", { name: "a" })

    rerender({ path: "/b" })

    expect(result.current).toMatchObject({ isLoading: true, data: undefined })
    await answer("/b", { name: "b" })
    expect(result.current.data).toEqual({ name: "b" })
  })

  it("aborts what's no longer asked for, so a late answer never shows", async () => {
    const { pending, answer } = deferredFetch()
    const { result, rerender } = renderHook(({ path }) => useApiResource(path), { initialProps: { path: "/slow" } })

    rerender({ path: "/fast" })
    expect(pending[0].options.signal.aborted).toBe(true)

    await answer("/fast", { name: "fast" })
    await answer("/slow", { name: "slow" })
    expect(result.current.data).toEqual({ name: "fast" })
  })

  it("fetches again when a dep changes, and not when only the path does", async () => {
    const { fetch, answer } = deferredFetch()
    const { result, rerender } = renderHook(({ path, user }) => useApiResource(path, { deps: [user] }), {
      initialProps: { path: "/topics?with_count", user: "alice" }
    })
    await answer("/topics?with_count", { count: 3 })

    // The count arrived and is no longer asked for: same deps, no request
    rerender({ path: "/topics", user: "alice" })
    expect(fetch).toHaveBeenCalledTimes(1)
    expect(result.current.data).toEqual({ count: 3 })

    rerender({ path: "/topics", user: "bob" })
    expect(fetch).toHaveBeenCalledTimes(2)
    expect(fetch.mock.calls[1][0]).toBe(`${API}/topics`)
  })

  it("changes the loaded data with setData and asks again with reload", async () => {
    const { fetch, answer, pending } = deferredFetch()
    const { result } = renderHook(() => useApiResource("/notifications"))
    await answer("/notifications", { unread: 2 })

    act(() => result.current.setData(prev => ({ ...prev, unread: 0 })))
    expect(result.current.data).toEqual({ unread: 0 })

    act(() => result.current.reload())
    expect(result.current.isLoading).toBe(true)
    expect(fetch).toHaveBeenCalledTimes(2)
    await act(async () => pending[1].resolve({ ok: true, status: 200, json: async () => ({ unread: 5 }) }))
    expect(result.current.data).toEqual({ unread: 5 })
  })
})
