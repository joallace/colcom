import { afterEach, describe, expect, it, vi } from "vitest"


const original = process.env.ACCESS_TOKEN_SECRET

afterEach(() => {
  process.env.ACCESS_TOKEN_SECRET = original
  vi.restoreAllMocks()
  vi.resetModules()
})

const loadWithSecret = async (secret: string | undefined) => {
  if (secret === undefined)
    delete process.env.ACCESS_TOKEN_SECRET
  else
    process.env.ACCESS_TOKEN_SECRET = secret

  const exit = vi.spyOn(process, "exit").mockImplementation((() => { throw new Error("exit") }) as any)
  const config = await import("@/config").then(module => module.default, () => undefined)
  return { config, exit }
}

describe("config", () => {
  it.each([
    ["missing", undefined],
    ["empty", ""],
    ["too short", "x".repeat(31)],
  ])("refuses to start when the secret is %s", async (_, secret) => {
    const { config, exit } = await loadWithSecret(secret)

    expect(exit).toHaveBeenCalledWith(1)
    expect(config).toBeUndefined()
  })

  it("accepts a secret of 32 characters or more", async () => {
    const { config, exit } = await loadWithSecret("y".repeat(32))

    expect(exit).not.toHaveBeenCalled()
    expect(config?.accessTokenSecret).toBe("y".repeat(32))
    expect(Object.isFrozen(config)).toBe(true)
  })
})

describe("settings", () => {
  const load = async () => (await import("@/config"))

  it("allows the Vite dev server outside production when CORS_ORIGIN is empty", async () => {
    const { parseOrigins } = await load()
    expect(parseOrigins(undefined, false)).toEqual(["http://localhost:5173", "http://127.0.0.1:5173"])
    expect(parseOrigins(" ", false)).toEqual(["http://localhost:5173", "http://127.0.0.1:5173"])
  })

  it("allows no other origin in production unless CORS_ORIGIN names one", async () => {
    const { parseOrigins } = await load()
    expect(parseOrigins(undefined, true)).toEqual([])
    expect(parseOrigins("https://colcom.example/, https://www.colcom.example", true))
      .toEqual(["https://colcom.example", "https://www.colcom.example"])
  })

  it.each([
    [undefined, "loopback"],
    ["", "loopback"],
    ["true", true],
    ["false", false],
    ["2", 2],
    ["10.0.0.0/8, loopback", "10.0.0.0/8, loopback"],
  ])("reads TRUST_PROXY %j as %j", async (value, expected) => {
    const { parseTrustProxy } = await load()
    expect(parseTrustProxy(value)).toEqual(expected)
  })

  it("reads rate limits as requests per window", async () => {
    const { parseRateLimit } = await load()
    expect(parseRateLimit("X", "10/15m", "1/1s")).toEqual({ max: 10, windowMs: 15 * 60_000 })
    expect(parseRateLimit("X", "5/1h", "1/1s")).toEqual({ max: 5, windowMs: 3_600_000 })
    expect(parseRateLimit("X", undefined, "30/10s")).toEqual({ max: 30, windowMs: 10_000 })
    expect(parseRateLimit("X", "off", "1/1s")).toBeNull()
    expect(parseRateLimit("X", "0", "1/1s")).toBeNull()
  })

  it.each(["10", "10/15", "ten/15m", "0/1m", "5/0m", "5/1w"])("refuses to start with the rate limit %j", async (value) => {
    const { parseRateLimit } = await load()
    vi.spyOn(process, "exit").mockImplementation((() => { throw new Error("exit") }) as any)
    expect(() => parseRateLimit("X", value, "1/1s")).toThrow("exit")
  })

  it("reads counts as whole numbers, with a fallback and a minimum", async () => {
    const { parseCount } = await load()
    expect(parseCount("X", "7", 3)).toBe(7)
    expect(parseCount("X", " 0 ", 3)).toBe(0)
    expect(parseCount("X", undefined, 3)).toBe(3)
    expect(parseCount("X", "", 3, 1)).toBe(3)
  })

  it.each([["-1", 0], ["1.5", 0], ["three", 0], ["0", 1]])("refuses to start with the count %j (minimum %i)", async (value, min) => {
    const { parseCount } = await load()
    vi.spyOn(process, "exit").mockImplementation((() => { throw new Error("exit") }) as any)
    expect(() => parseCount("X", value, 3, min)).toThrow("exit")
  })
})
