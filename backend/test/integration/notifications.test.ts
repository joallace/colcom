// On-site notifications: who is told about what, and reading them
import { beforeAll, describe, expect, it } from "vitest"

import { api, createPost, createTopic, critique, critiqueConfig, edit, interact, latestCommit, signUp, TestUser, unique } from "../support/api"


let author: TestUser, other: TestUser

beforeAll(async () => {
  [author, other] = await Promise.all([signUp(), signUp()])
})

// Every user here starts with none, so a fresh one is used whenever counts matter
const inbox = async (user: TestUser, query = "") => {
  const res = await api().get(`/notifications${query}`).set(user.auth)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return res.body
}

const unreadCount = async (user: TestUser) => (await api().get("/notifications/unread").set(user.auth)).body.unread

const markRead = (user: TestUser, body: object = {}) => api().post("/notifications/read").set(user.auth).send(body)

async function suggest(postId: number, user = other) {
  const res = await edit(user, postId, `<p>${unique("Suggested")}</p>`, "Suggests a better intro")
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return res.body.config.commit as string
}

describe("who is told", () => {
  it("tells a post's author about a critique, with what links to it", async () => {
    const owner = await signUp()
    const topic = await createTopic(other)
    const post = await createPost(owner, topic.id)
    const commit = await latestCommit(post.id)
    const made = await critique(other, post.id, critiqueConfig(commit))
    expect(made.status).toBe(201)

    const { notifications, count, unread } = await inbox(owner)
    expect(count).toBe(1)
    expect(unread).toBe(1)
    expect(notifications[0]).toMatchObject({
      type: "critique",
      read: false,
      actor: { name: other.name },
      content: { id: post.id, title: post.title, type: "post" },
      topic_id: topic.id,
      subject: { id: made.body.id, title: made.body.title, type: "critique", commit },
      suggestion: null
    })
    expect(notifications[0].actor.avatar).toMatch(/^[A-Za-z0-9+/=]+$/)
  })

  it("tells a topic's author about a new post", async () => {
    const owner = await signUp()
    const topic = await createTopic(owner)
    const post = await createPost(other, topic.id)

    const [notification] = (await inbox(owner)).notifications
    expect(notification).toMatchObject({
      type: "post",
      content: { id: topic.id, type: "topic" },
      topic_id: topic.id,
      subject: { id: post.id, title: post.title, type: "post", commit: null }
    })
  })

  it("tells a post's author about a suggestion, and the suggester about its answer", async () => {
    const [owner, suggester] = await Promise.all([signUp(), signUp()])
    const topic = await createTopic(owner)
    const post = await createPost(owner, topic.id)

    const accepted = await suggest(post.id, suggester)
    const rejected = await suggest(post.id, suggester)

    const forOwner = (await inbox(owner)).notifications.filter((n: any) => n.type === "suggestion")
    expect(forOwner).toHaveLength(2)
    expect(forOwner[0]).toMatchObject({ actor: { name: suggester.name }, content: { id: post.id }, suggestion: { commit: rejected, message: "Suggests a better intro" } })
    expect(forOwner[1].suggestion.commit).toBe(accepted)

    expect((await api().post(`/contents/${post.id}/${accepted}/merge`).set(owner.auth)).status).toBe(204)
    expect((await api().post(`/contents/${post.id}/${rejected}/reject`).set(owner.auth)).status).toBe(200)

    const { notifications } = await inbox(suggester)
    expect(notifications.map((n: any) => [n.type, n.suggestion.commit])).toEqual([
      ["suggestion_rejected", rejected],
      ["suggestion_accepted", accepted]
    ])
    expect(notifications[0]).toMatchObject({ actor: { name: owner.name }, content: { id: post.id, title: post.title }, topic_id: topic.id })
  })

  it("tells a post's author that it was cloned", async () => {
    const owner = await signUp()
    const topic = await createTopic(other)
    const post = await createPost(owner, topic.id)
    const title = unique("Clone")
    const clone = await api().post(`/contents/${post.id}/${await latestCommit(post.id)}/clone`).set(other.auth).send({ title })
    expect(clone.status).toBe(200)

    const [notification] = (await inbox(owner)).notifications
    expect(notification).toMatchObject({ type: "clone", content: { id: post.id }, subject: { id: clone.body.id, title } })
  })

  it("never tells anyone about what they did themselves", async () => {
    const owner = await signUp()
    const topic = await createTopic(owner)
    const post = await createPost(owner, topic.id)
    expect((await critique(owner, post.id, critiqueConfig(await latestCommit(post.id)))).status).toBe(201)
    expect((await edit(owner, post.id, "<p>Rewritten.</p>")).status).toBe(200)
    expect((await api().post(`/contents/${post.id}/${await latestCommit(post.id)}/clone`).set(owner.auth).send({ title: unique("Clone") })).status).toBe(200)

    expect(await inbox(owner)).toEqual({ notifications: [], count: 0, unread: 0 })
  })

  it("doesn't notify reactions, votes or bookmarks", async () => {
    const owner = await signUp()
    const topic = await createTopic(owner)
    const post = await createPost(owner, topic.id)

    for (const type of ["up", "vote", "bookmark"])
      expect((await interact(other, post.id, type)).status).toBe(201)

    expect((await inbox(owner)).count).toBe(0)
  })

  it("doesn't notify a critique that was refused", async () => {
    const owner = await signUp()
    const post = await createPost(owner, (await createTopic(other)).id)
    const foreign = await latestCommit((await createPost(other, (await createTopic(other)).id)).id)

    expect((await critique(other, post.id, critiqueConfig(foreign))).status).toBe(400)
    expect((await inbox(owner)).count).toBe(0)
  })
})

describe("reading notifications", () => {
  async function userWithNotifications(amount: number) {
    const owner = await signUp()
    const topic = await createTopic(owner)
    for (let i = 0; i < amount; i++)
      await createPost(other, topic.id)
    return owner
  }

  it("lists the newest first, paginated", async () => {
    const owner = await userWithNotifications(3)

    const first = await inbox(owner, "?pageSize=2")
    expect(first.count).toBe(3)
    expect(first.notifications).toHaveLength(2)
    expect(first.notifications[0].id).toBeGreaterThan(first.notifications[1].id)

    const second = await inbox(owner, "?pageSize=2&page=2")
    expect(second.notifications).toHaveLength(1)
    expect(second.notifications[0].id).toBeLessThan(first.notifications[1].id)

    // Past the end there's no row to carry the total
    expect(await inbox(owner, "?pageSize=2&page=5")).toEqual({ notifications: [], count: 3, unread: 3 })
  })

  it("marks some as read, then all of them", async () => {
    const owner = await userWithNotifications(3)
    const [newest, middle] = (await inbox(owner)).notifications

    const some = await markRead(owner, { ids: [newest.id, middle.id] })
    expect(some.status).toBe(200)
    expect(some.body).toEqual({ read: 2, unread: 1 })
    expect(await unreadCount(owner)).toBe(1)

    const unread = await inbox(owner, "?unread=true")
    expect(unread.count).toBe(1)
    expect(unread.notifications[0].read).toBe(false)
    expect((await inbox(owner)).notifications.map((n: any) => n.read)).toEqual([true, true, false])

    expect((await markRead(owner)).body).toEqual({ read: 1, unread: 0 })
    // Already read: nothing changes
    expect((await markRead(owner)).body).toEqual({ read: 0, unread: 0 })
  })

  it("can't mark someone else's notifications as read", async () => {
    const owner = await userWithNotifications(1)
    const [notification] = (await inbox(owner)).notifications

    expect((await markRead(other, { ids: [notification.id] })).body.read).toBe(0)
    expect(await unreadCount(owner)).toBe(1)
  })

  it("requires logging in", async () => {
    // authHandler answers a missing token with a 400, and a bad one with a 401
    expect((await api().get("/notifications")).status).toBe(400)
    expect((await api().get("/notifications/unread")).status).toBe(400)
    expect((await api().post("/notifications/read").send({})).status).toBe(400)
    expect((await api().get("/notifications").set({ Authorization: "Bearer nope" })).status).toBe(401)
  })

  it.each([
    [{ ids: [] }],
    [{ ids: ["x"] }],
    [{ ids: [1, 1] }],
    [{ ids: 1 }]
  ])("refuses %j", async body => {
    const res = await markRead(author, body)
    expect(res.status).toBe(400)
    expect(res.body.key).toMatch(/^ids/)
  })
})
