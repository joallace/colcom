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
    expect(config).toEqual({ accessTokenSecret: "y".repeat(32) })
    expect(Object.isFrozen(config)).toBe(true)
  })
})
