// Helpers for integration tests: they go through the HTTP API, like the frontend does, so each
// test exercises routing, auth, controllers, SQL and git together.
import request from "supertest"
import { expect } from "vitest"

import app from "@/app"


export const api = () => request(app)

// A 1x1 PNG, the smallest valid avatar
export const AVATAR = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

let counter = 0
// Names and titles are unique site-wide, so every helper call gets a fresh one
export const unique = (prefix: string) => `${prefix} ${++counter}`

export interface TestUser {
  pid: string,
  name: string,
  email: string,
  pass: string,
  token: string,
  auth: { Authorization: string }
}

export async function signUp(name = unique("user").replace(" ", "_")): Promise<TestUser> {
  const email = `${name}@colcom.test`
  const pass = "correct horse battery staple"

  const created = await api().post("/users").send({ name, email, pass, avatar: AVATAR })
  expect(created.status, JSON.stringify(created.body)).toBe(201)

  const login = await api().post("/login").send({ login: name, pass })
  expect(login.status, JSON.stringify(login.body)).toBe(200)

  const token = login.body.accessToken
  return { pid: created.body.pid, name, email, pass, token, auth: { Authorization: `Bearer ${token}` } }
}

export async function createTopic(user: TestUser, { title = unique("Topic"), body = "<p>What do you think?</p>", answers = ["sim", "não"], tags = [] as string[] } = {}) {
  const res = await api().post("/contents").set(user.auth).send({ title, body, config: { answers }, tags })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return res.body
}

export async function createPost(user: TestUser, topicId: number, { title = unique("Post"), body = "<p>First paragraph.</p><p>Second paragraph.</p>", answer = "sim" } = {}) {
  const res = await api().post("/contents").set(user.auth).send({ title, body, parent_id: topicId, config: { answer } })
  expect(res.status, JSON.stringify(res.body)).toBe(201)
  return res.body
}

export async function history(postId: number, user?: TestUser): Promise<{ commit: string, subject: string, date: string, author: string }[]> {
  const req = api().get(`/contents/${postId}`)
  const res = await (user ? req.set(user.auth) : req)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return res.body.history
}

export const latestCommit = async (postId: number) => (await history(postId)).at(-1)!.commit

export async function edit(user: TestUser, postId: number, body: string, message = unique("edit")) {
  return await api().patch(`/contents/${postId}`).set(user.auth).send({ body, message })
}

export const critiqueConfig = (commit: string, exact = "First", { from = 1, to = 6, prefix = "", suffix = " paragraph.", start = 0 } = {}) =>
  ({ commit, from, to, quote: { exact, prefix, suffix, start } })

export async function critique(user: TestUser, postId: number, config: object, { title = unique("Critique"), body = "<p>I disagree.</p>" } = {}) {
  return await api().post("/contents").set(user.auth).send({ title, body, parent_id: postId, config })
}

export const interact = (user: TestUser, content_id: number, type: string) =>
  api().post("/interactions").set(user.auth).send({ content_id, type })

// Endorses (1), contests (-1) or withdraws (0) a tag on a topic
export const voteTag = (user: TestUser, topicId: number, tag: string, value: 1 | -1 | 0) =>
  api().post(`/topics/${topicId}/tags`).set(user.auth).send({ tag, value })

// An action on a critique's lifecycle: address, rebut, accept, dispute, withdraw
export const act = (user: TestUser, critiqueId: number, body: object) =>
  api().post(`/contents/${critiqueId}/events`).set(user.auth).send(body)

// A post by `author` criticised by `critic` on its first version, then edited by the author: `fix`
// is the version that can address the critique
export async function criticised(author: TestUser, critic: TestUser) {
  const topic = await createTopic(author)
  const post = await createPost(author, topic.id)
  const made = await critique(critic, post.id, critiqueConfig(await latestCommit(post.id)))
  expect(made.status, JSON.stringify(made.body)).toBe(201)

  expect((await edit(author, post.id, "<p>First paragraph, fixed.</p><p>Second paragraph.</p>")).status).toBe(200)
  return { topic, post, critiqueId: made.body.id as number, fix: await latestCommit(post.id) }
}

// A critique by `critic` of a post by `author`, resolved: the author addresses it with a fix (or
// rebuts it) and the critic accepts the answer
export async function resolveCritique(author: TestUser, critic: TestUser, answer: "address" | "rebut" = "address") {
  const made = await criticised(author, critic)
  const answered = await act(author, made.critiqueId, answer === "address" ? { action: "address", commit: made.fix } : { action: "rebut", note: "Não procede." })
  expect(answered.status, JSON.stringify(answered.body)).toBe(201)

  const accepted = await act(critic, made.critiqueId, { action: "accept" })
  expect(accepted.status, JSON.stringify(accepted.body)).toBe(201)
  return made
}

// A suggestion by `suggester` to a post by `author` (a new one unless given), merged by the author
export async function mergeSuggestion(author: TestUser, suggester: TestUser, postId?: number) {
  const post = postId ?? (await createPost(author, (await createTopic(author)).id)).id
  const suggested = await edit(suggester, post, `<p>${unique("Suggested")}</p><p>Second paragraph.</p>`)
  expect(suggested.status, JSON.stringify(suggested.body)).toBe(200)

  const merged = await api().post(`/contents/${post}/${suggested.body.config.commit}/merge`).set(author.auth)
  expect(merged.status, JSON.stringify(merged.body)).toBe(204)
  return { postId: post, suggestionId: suggested.body.id as number }
}

// A user's prestige and its awards, as their profile gets them
export async function prestigeOf(user: TestUser, query: Record<string, number> = {}) {
  const res = await api().get(`/users/${user.name}/prestige`).query(query)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return res.body as { prestige: number, count: number, events: any[] }
}

// A topic's tags as the topic page gets them, with the user's votes when given
export async function topicTags(topicId: number, user?: TestUser): Promise<any[]> {
  const req = api().get(`/topics/${topicId}`)
  const res = await (user ? req.set(user.auth) : req)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return res.body.tags
}
