import { describe, expect, it } from "vitest"
import jwt from "jsonwebtoken"

import { api, AVATAR, signUp, unique } from "../support/api"


describe("POST /users", () => {
  it("creates a user and returns its public data only", async () => {
    const name = unique("alice").replace(" ", "_")
    const res = await api().post("/users").send({ name, email: `${name}@colcom.test`, pass: "a long enough secret", avatar: AVATAR })

    expect(res.status).toBe(201)
    expect(res.body).toEqual({ pid: expect.any(String), name, created_at: expect.any(String) })
    expect(res.body).not.toHaveProperty("pass")
  })

  it.each(["name", "pass", "email", "avatar"])("requires %s", async field => {
    const user = { name: unique("bob").replace(" ", "_"), email: `${unique("bob").replace(" ", "_")}@colcom.test`, pass: "a long enough secret", avatar: AVATAR }
    const res = await api().post("/users").send({ ...user, [field]: undefined })

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ name: "ValidationError", key: field })
    expect(res.body.message).toMatch(/: campo obrigatório\.$/)
  })

  it("refuses a name or email already in use, ignoring case", async () => {
    const existing = await signUp()

    const sameName = await api().post("/users").send({ name: existing.name.toUpperCase(), email: "other@colcom.test", pass: "a long enough secret", avatar: AVATAR })
    expect(sameName.status).toBe(400)
    expect(sameName.body).toMatchObject({ key: "name" })

    const sameEmail = await api().post("/users").send({ name: unique("carol").replace(" ", "_"), email: existing.email.toUpperCase(), pass: "a long enough secret", avatar: AVATAR })
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

describe("GET /users/:name", () => {
  it("returns anyone's public profile, ignoring the name's case", async () => {
    const user = await signUp()
    const res = await api().get(`/users/${user.name.toUpperCase()}`)

    expect(res.status).toBe(200)
    expect(res.body).toEqual({ pid: user.pid, name: user.name, avatar: AVATAR, created_at: expect.any(String) })
  })

  it("finds names with spaces", async () => {
    const name = unique("erin")
    const created = await api().post("/users").send({ name, email: `${name.replace(" ", "_")}@colcom.test`, pass: "a long enough secret", avatar: AVATAR })
    const res = await api().get(`/users/${encodeURIComponent(name)}`)

    expect(res.status).toBe(200)
    expect(res.body.pid).toBe(created.body.pid)
  })

  it("answers 404 for an unknown name", async () => {
    const res = await api().get("/users/nobody_here")
    expect(res.status).toBe(404)
    expect(res.body).toMatchObject({ key: "name", message: "Usuário não encontrado." })
  })

  it("refuses an email, which a name can't be", async () => {
    const user = await signUp()
    const res = await api().get(`/users/${encodeURIComponent(user.email)}`)

    expect(res.status).toBe(400)
    expect(res.body.key).toBe("name")
  })

  it("leaves /users/self to the logged in user", async () => {
    const res = await api().get("/users/self")
    expect(res.status).toBe(400)
    expect(res.body.message).toBe("Token de autorização não fornecido.")
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

describe("sign up validation", () => {
  const newUser = (fields: object = {}) => {
    const name = unique("dave").replace(" ", "_")
    return { name, email: `${name}@colcom.test`, pass: "a long enough secret", avatar: AVATAR, ...fields }
  }

  it("reports every invalid field, with messages for the form", async () => {
    const res = await api().post("/users").send(newUser({ name: "a@b", pass: "short", avatar: "not a png" }))

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ key: "name", message: 'Nome de usuário: não pode conter "@".' })
    expect(res.body.errors).toEqual([
      { key: "name", label: "nome de usuário", message: 'não pode conter "@"' },
      { key: "pass", label: "senha", message: "mínimo de 8 caracteres" },
      { key: "avatar", label: "foto de perfil", message: "imagem inválida" }
    ])
  })

  it("reserves the name \"self\", taken by GET /users/self", async () => {
    const res = await api().post("/users").send(newUser({ name: "self" }))

    expect(res.status).toBe(400)
    expect(res.body).toMatchObject({ key: "name", message: "Nome de usuário: nome reservado." })
  })

  it("refuses a password longer than bcrypt reads", async () => {
    const res = await api().post("/users").send(newUser({ pass: "x".repeat(73) }))
    expect(res.status).toBe(400)
    expect(res.body.key).toBe("pass")
  })

  it("lets users log in by any valid email, not only short top-level domains", async () => {
    const user = newUser()
    user.email = `${user.name}@colcom.museum`
    expect((await api().post("/users").send(user)).status).toBe(201)

    const res = await api().post("/login").send({ login: user.email, pass: user.pass })
    expect(res.status).toBe(200)
  })
})
