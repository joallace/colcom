import express from "express"
import jwt from "jsonwebtoken"
import request from "supertest"
import { beforeEach, describe, expect, it, vi } from "vitest"

import authHandler from "@/middleware/authHandler"
import errorHandler from "@/middleware/errorHandler"
import { ConflictError, ForbiddenError, NotFoundError } from "@/errors"
import User from "@/models/user"

// authHandler asks the database for the user's current token version
vi.mock("@/models/user", () => ({ default: { tokenVersion: vi.fn() } }))


const secret = process.env.ACCESS_TOKEN_SECRET!
const user = { username: "alice", email: "alice@colcom.test", pid: "6f1c3a4e-0000-4000-8000-000000000000" }

function appWith(handler: express.RequestHandler) {
  const app = express()
  app.use(express.json())
  app.get("/", handler, (req, res) => { res.json({ user: res.locals.user ?? null }) })
  app.use(errorHandler)
  return app
}

describe("authHandler", () => {
  const required = appWith(authHandler())
  const optional = appWith(authHandler(true))
  const token = jwt.sign({ user, ver: 2 }, secret, { expiresIn: "1h" })
  const tokenVersion = vi.mocked(User.tokenVersion)

  beforeEach(() => {
    tokenVersion.mockReset()
    tokenVersion.mockResolvedValue(2)
  })

  it("puts the token's user in res.locals", async () => {
    const res = await request(required).get("/").set("Authorization", `Bearer ${token}`)
    expect(res.status).toBe(200)
    expect(res.body.user).toEqual(user)
  })

  it.each([
    ["no header", undefined],
    ["another scheme", `Basic ${token}`],
    ["an empty bearer", "Bearer "],
  ])("requires a token: %s", async (_, header) => {
    const req = request(required).get("/")
    const res = await (header === undefined ? req : req.set("Authorization", header))

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Token de autorização não fornecido.")
  })

  it.each([
    ["signed with another secret", jwt.sign({ user }, "x".repeat(32))],
    ["expired", jwt.sign({ user, exp: Math.floor(Date.now() / 1000) - 60 }, secret)],
    ["unsigned", jwt.sign({ user }, "", { algorithm: "none" })],
    ["garbage", "not.a.jwt"],
  ])("refuses a token %s", async (_, bad) => {
    const res = await request(required).get("/").set("Authorization", `Bearer ${bad}`)

    expect(res.status).toBe(401)
    expect(res.body.message).toBe("Token inválido")
  })

  it("lets anonymous requests through when optional", async () => {
    const res = await request(optional).get("/")
    expect(res.status).toBe(200)
    expect(res.body.user).toBeNull()
  })

  it("still refuses a bad token when optional", async () => {
    const res = await request(optional).get("/").set("Authorization", "Bearer not.a.jwt")
    expect(res.status).toBe(401)
  })

  it("reads the user when optional and a token is given", async () => {
    const res = await request(optional).get("/").set("Authorization", `Bearer ${token}`)
    expect(res.body.user).toEqual(user)
  })

  it.each([
    ["an older version", 3],
    ["a deleted user", undefined],
  ])("refuses a revoked token: %s", async (_, current) => {
    tokenVersion.mockResolvedValue(current)

    for (const app of [required, optional]) {
      const res = await request(app).get("/").set("Authorization", `Bearer ${token}`)
      expect(res.status).toBe(401)
      expect(res.body.message).toBe("Sessão encerrada.")
    }
    expect(tokenVersion).toHaveBeenCalledWith(user.pid)
  })

  it("refuses a token without a version", async () => {
    const res = await request(required).get("/").set("Authorization", `Bearer ${jwt.sign({ user }, secret)}`)
    expect(res.status).toBe(401)
  })

  it("doesn't ask the database about a token it can't verify", async () => {
    await request(required).get("/").set("Authorization", "Bearer not.a.jwt")
    expect(tokenVersion).not.toHaveBeenCalled()
  })
})

describe("errorHandler", () => {
  const failWith = (error: unknown) => appWith(() => { throw error })

  it("returns our errors as they are, without their stack", async () => {
    const res = await request(failWith(new NotFoundError({ message: "Sumiu.", key: "id", stack: "secret stack" }))).get("/")

    expect(res.status).toBe(404)
    expect(res.body).toEqual({
      name: "NotFoundError",
      message: "Sumiu.",
      action: "Verifique se o caminho (PATH) e o método (GET, POST, PUT, DELETE) estão corretos.",
      statusCode: 404,
      errorId: expect.any(String),
      key: "id"
    })
  })

  // Express 5 passes a rejected promise to the error handler: controllers don't catch to call next
  it("gets the errors async handlers throw", async () => {
    const app = appWith(async () => {
      await Promise.resolve()
      throw new ConflictError({ message: "Já existe.", errorLocationCode: "HERE" })
    })
    const res = await request(app).get("/")

    expect(res.status).toBe(409)
    expect(res.body).toEqual({
      name: "ConflictError",
      message: "Já existe.",
      action: "Atualize a página e tente novamente.",
      statusCode: 409,
      errorId: expect.any(String),
      errorLocationCode: "HERE"
    })
  })

  it("hides what async handlers throw that isn't ours", async () => {
    const res = await request(appWith(async () => { throw new Error("pg detail") })).get("/")
    expect(res.status).toBe(500)
    expect(res.body.name).toBe("InternalServerError")
    expect(JSON.stringify(res.body)).not.toContain("pg detail")
  })

  it("keeps the status of each error class", async () => {
    expect((await request(failWith(new ForbiddenError({}))).get("/")).status).toBe(403)
  })

  it("hides any other error behind a generic one", async () => {
    const leaky = Object.assign(new Error('relation "users" violates constraint "users_pkey"'), { code: "23505", table: "users" })
    const res = await request(failWith(leaky)).get("/")

    expect(res.status).toBe(500)
    expect(res.body).toEqual({
      name: "InternalServerError",
      message: "Um erro interno não esperado aconteceu.",
      action: "Informe ao suporte o valor encontrado no campo 'error_id'.",
      statusCode: 500,
      errorId: expect.stringMatching(/^[0-9a-f-]{36}$/)
    })
  })

  it("exposes express' own client errors", async () => {
    const app = express()
    app.use(express.json())
    app.post("/", (req, res) => { res.json(req.body) })
    app.use(errorHandler)

    const res = await request(app).post("/").set("Content-Type", "application/json").send("{oops")

    expect(res.status).toBe(400)
    expect(res.body.name).toBe("ValidationError")
  })

  it("gives every error its own id", async () => {
    const app = failWith(new Error("x"))
    const [a, b] = await Promise.all([request(app).get("/"), request(app).get("/")])
    expect(a.body.errorId).not.toBe(b.body.errorId)
  })
})
