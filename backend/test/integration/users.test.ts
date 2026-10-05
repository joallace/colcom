import { describe, expect, it } from "vitest"
import jwt from "jsonwebtoken"

import { api, AVATAR, signUp, unique } from "../support/api"


describe("POST /users", () => {
  it("creates a user and returns its public data only", async () => {
    const name = unique("alice").replace(" ", "_")
    const res = await api().post("/users").send({ name, email: `${name}@colcom.test`, pass: "secret", avatar: AVATAR })

    expect(res.status).toBe(201)
    expect(res.body).toEqual({ pid: expect.any(String), name, created_at: expect.any(String) })
    expect(res.body).not.toHaveProperty("pass")
  })

  it.each(["name", "pass", "email", "avatar"])("requires %s", async field => {
    const user = { name: unique("bob").replace(" ", "_"), email: `${unique("bob").replace(" ", "_")}@colcom.test`, pass: "secret", avatar: AVATAR }
    const res = await api().post("/users").send({ ...user, [field]: undefined })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ name: "ValidationError", message: `"${field}" é um campo obrigatório` })
  })

  it("refuses a name or email already in use, ignoring case", async () => {
    const existing = await signUp()

    const sameName = await api().post("/users").send({ name: existing.name.toUpperCase(), email: "other@colcom.test", pass: "x", avatar: AVATAR })
    expect(sameName.status).toBe(400)
    expect(sameName.body).toMatchObject({ key: "name" })

    const sameEmail = await api().post("/users").send({ name: unique("carol").replace(" ", "_"), email: existing.email.toUpperCase(), pass: "x", avatar: AVATAR })
    expect(sameEmail.status).toBe(400)
    expect(sameEmail.body).toMatchObject({ key: "email" })
  })
})

describe("POST /login", () => {
  it("logs in by name or by email, returning a token for the user", async () => {
    const user = await signUp()

    for (const login of [user.name, user.email]) {
      const res = await api().post("/login").send({ login, pass: user.pass })
      expect(res.status).toBe(200)

      const decoded = jwt.verify(res.body.accessToken, process.env.ACCESS_TOKEN_SECRET!) as any
      expect(decoded.user).toEqual({ username: user.name, email: user.email, pid: user.pid })
      expect(decoded.exp - decoded.iat).toBe(7 * 24 * 60 * 60)
    }
  })

  it("refuses a wrong password", async () => {
    const user = await signUp()
    const res = await api().post("/login").send({ login: user.name, pass: "wrong" })

    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Combinação de login e senha inválida.")
    expect(res.body).not.toHaveProperty("accessToken")
  })

  it("answers 404 for an unknown user", async () => {
    const res = await api().post("/login").send({ login: "nobody_here", pass: "x" })
    expect(res.status).toBe(404)
    expect(res.body.key).toBe("name")
  })
})

describe("GET /users/self", () => {
  it("returns the logged in user, without the password, and the topic they promote", async () => {
    const user = await signUp()
    const res = await api().get("/users/self").set(user.auth)

    expect(res.status).toBe(200)
    expect(res.body).toMatchObject({ pid: user.pid, name: user.name, avatar: AVATAR, colcoins: 0, prestige: 0 })
    expect(res.body).not.toHaveProperty("pass")
    expect(res.body).not.toHaveProperty("email")
    expect(res.body.promoting).toBeUndefined()
  })

  it("requires a token", async () => {
    const res = await api().get("/users/self")
    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Token de autorização não fornecido.")
  })

  it("refuses a token signed with another secret", async () => {
    const forged = jwt.sign({ user: { pid: "00000000-0000-0000-0000-000000000000" } }, "another-secret-of-at-least-32-characters")
    const res = await api().get("/users/self").set({ Authorization: `Bearer ${forged}` })

    expect(res.status).toBe(401)
  })
})

describe("GET /users", () => {
  it("lists users without sensitive data", async () => {
    await signUp()
    const res = await api().get("/users")

    expect(res.status).toBe(200)
    expect(res.body.length).toBeGreaterThan(0)
    for (const user of res.body) {
      expect(user).not.toHaveProperty("pass")
      expect(user).not.toHaveProperty("email")
    }
  })

  it("refuses an unknown sort key instead of interpolating it", async () => {
    const res = await api().get("/users").query({ orderBy: "id; DROP TABLE users" })
    expect(res.status).toBe(400)
    expect(res.body.key).toBe("orderBy")
  })
})
