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

  it("allows cross-origin requests from the Vite dev server outside production", async () => {
    const res = await api().options("/topics").set("Origin", "http://localhost:5173").set("Access-Control-Request-Method", "GET")
    expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173")
  })

  it("doesn't allow cross-origin requests from other origins", async () => {
    const preflight = await api().options("/topics").set("Origin", "http://example.com").set("Access-Control-Request-Method", "POST")
    expect(preflight.headers).not.toHaveProperty("access-control-allow-origin")

    const res = await api().get("/topics").set("Origin", "http://example.com")
    expect(res.headers).not.toHaveProperty("access-control-allow-origin")
  })

  it("answers same-origin requests, which send no Origin", async () => {
    expect((await api().get("/topics")).status).toBe(200)
  })

  it.each([
    ["GET", "/nothing/here"],
    ["POST", "/topics"],
    ["DELETE", "/contents/1"],
  ])("answers an unknown route (%s %s) with a JSON 404", async (method, path) => {
    const res = await (api() as any)[method.toLowerCase()](path)

    expect(res.status).toBe(404)
    expect(res.headers["content-type"]).toMatch(/json/)
    expect(res.body).toMatchObject({ name: "NotFoundError", statusCode: 404, message: `A rota ${method} ${path} não existe.` })
    expect(res.body.action).toBeTruthy()
    expect(res.body).not.toHaveProperty("stack")
  })
})
