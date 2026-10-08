import { afterEach, describe, expect, it, vi } from "vitest"

const load = async () => {
  vi.resetModules()
  return (await import("@/assets/enviroment")).default
}

describe("apiAddress", () => {
  afterEach(() => vi.unstubAllEnvs())

  it("uses VITE_API_ADDRESS when it is set", async () => {
    vi.stubEnv("VITE_API_ADDRESS", "https://example.org/api")
    expect((await load()).apiAddress).toBe("https://example.org/api")
  })

  it("talks to the backend directly in development", async () => {
    vi.stubEnv("VITE_API_ADDRESS", "")
    vi.stubEnv("DEV", true)
    expect((await load()).apiAddress).toBe("http://localhost:3000")
  })

  // nginx proxies /api/ on the same origin, so a build works from any host
  it("defaults to the relative /api in a production build", async () => {
    vi.stubEnv("VITE_API_ADDRESS", "")
    vi.stubEnv("DEV", false)
    expect((await load()).apiAddress).toBe("/api")
  })
})
