import { describe, expect, it } from "vitest"

import { api } from "../support/api"


describe("the server", () => {
  it("answers on /", async () => {
    const res = await api().get("/")
    expect(res.status).toBe(200)
    expect(res.text).toBe("I'm alive!")
  })

  it("answers a malformed JSON body with a validation error", async () => {
    const res = await api().post("/login").set("Content-Type", "application/json").send('{"login": ')

    expect(res.status).toBe(400)
    expect(res.body.name).toBe("ValidationError")
    expect(res.body).not.toHaveProperty("stack")
  })

  it("allows cross-origin requests", async () => {
    const res = await api().options("/topics").set("Origin", "http://example.com").set("Access-Control-Request-Method", "GET")
    expect(res.headers["access-control-allow-origin"]).toBe("*")
  })
})
