import { describe, expect, it } from "vitest"

import { api, createPost, createTopic, signUp, unique } from "../support/api"


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

  // Express 5 sends a rejected async handler's error to errorHandler, so handlers don't catch it
  describe("an error thrown by an async handler", () => {
    it("is answered as JSON with its status", async () => {
      const user = await signUp()
      const topic = await createTopic(user)
      const post = await createPost(user, topic.id)

      const res = await api().get(`/topics/${post.id}`)

      expect(res.status).toBe(404)
      expect(res.body).toEqual({
        name: "NotFoundError",
        message: "Tópico não encontrado.",
        action: 'Verifique se o "id" fornecido está correto.',
        statusCode: 404,
        errorId: expect.stringMatching(/^[0-9a-f-]{36}$/)
      })
    })

    it.each([
      ["a missing content", () => api().get("/contents/2147483647"), "Conteúdo não encontrado."],
      ["a topic where a post is expected", (topicId: number) => api().get(`/contents/${topicId}/${"a".repeat(40)}/merge`), "Post não encontrado."],
      ["a topic's poll history of a post", (_: number, postId: number) => api().get(`/topics/${postId}/votes`), "Tópico não encontrado."],
    ])("names what's missing: %s", async (_, send, message) => {
      const user = await signUp()
      const topic = await createTopic(user)
      const post = await createPost(user, topic.id)

      const res = await send(topic.id, post.id).set(user.auth)

      expect(res.status).toBe(404)
      expect(res.body).toEqual({
        name: "NotFoundError",
        message,
        action: 'Verifique se o "id" fornecido está correto.',
        statusCode: 404,
        errorId: expect.any(String)
      })
    })

    it("keeps its key and location", async () => {
      const user = await signUp()
      const topic = await createTopic(user, { answers: ["sim", "não"] })

      const res = await api().post("/contents").set(user.auth)
        .send({ parent_id: topic.id, title: unique("Post"), body: "<p>Talvez.</p>", config: { answer: "talvez" } })

      expect(res.status).toBe(400)
      expect(res.body).toEqual({
        name: "ValidationError",
        message: "Resposta: escolha uma das respostas do tópico.",
        action: "Utilize um dos valores: sim, não.",
        statusCode: 400,
        errorId: expect.any(String),
        errorLocationCode: "CONTROLLER:CONTENT:VALIDATE_ANSWER",
        key: "config.answer"
      })
    })
  })
})
