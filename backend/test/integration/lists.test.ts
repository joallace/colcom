// A topic's page, a user's contents (profile) and bookmarks
import { beforeAll, describe, expect, it } from "vitest"

import { api, AVATAR, createPost, createTopic, critique, critiqueConfig, interact, latestCommit, signUp, TestUser } from "../support/api"


describe("GET /topics/:id", () => {
  let author: TestUser, voters: TestUser[]

  beforeAll(async () => {
    [author, ...voters] = await Promise.all([signUp(), signUp(), signUp(), signUp()])
  })

  it("ranks posts by poll votes, then up votes, then age, with stats over all of them", async () => {
    const topic = await createTopic(author)
    const [oldest, upvoted, voted, mostVoted] = [
      await createPost(author, topic.id),
      await createPost(author, topic.id),
      await createPost(author, topic.id),
      await createPost(author, topic.id, { answer: "não" })
    ]
    await interact(voters[0], mostVoted.id, "vote")
    await interact(voters[1], mostVoted.id, "vote")
    await interact(voters[2], voted.id, "vote")
    await interact(voters[0], upvoted.id, "up")
    await interact(voters[1], oldest.id, "down")

    const res = await api().get(`/topics/${topic.id}`)

    expect(res.status).toBe(200)
    expect(res.body.children.map((post: any) => post.id)).toEqual([mostVoted.id, voted.id, upvoted.id, oldest.id])
    expect(res.body.children[0]).toMatchObject({ votes: 2, upvotes: 0, downvotes: 0, author: author.name, author_avatar: AVATAR, config: { answer: "não" } })
    expect(res.body.childrenStats).toEqual({ count: 4, upvotes: 1, downvotes: 1, votes: 3 })
  })

  it("includes the viewer's interactions and vote only for a logged in viewer", async () => {
    const topic = await createTopic(author)
    const post = await createPost(author, topic.id)
    await interact(voters[0], post.id, "vote")
    await interact(voters[0], topic.id, "bookmark")

    const anonymous = (await api().get(`/topics/${topic.id}`)).body
    expect(anonymous).toMatchObject({ userInteractions: null, userVote: null })

    const voter = (await api().get(`/topics/${topic.id}`).set(voters[0].auth)).body
    expect(voter).toMatchObject({ userInteractions: ["bookmark"], userVote: post.id })
  })

  it("answers 404 for anything but a topic", async () => {
    const topic = await createTopic(author)
    const post = await createPost(author, topic.id)

    expect((await api().get(`/topics/${post.id}`)).status).toBe(404)
    expect((await api().get("/topics/999999")).status).toBe(404)
  })

  it("lists a topic without posts with empty stats", async () => {
    const topic = await createTopic(author)
    const res = await api().get(`/topics/${topic.id}`)

    expect(res.body).toMatchObject({ children: [], childrenStats: { count: 0, upvotes: 0, downvotes: 0, votes: 0 } })
  })
})

describe("GET /contents (a user's profile)", () => {
  let author: TestUser, other: TestUser
  let topic: any, post: any, made: any

  beforeAll(async () => {
    [author, other] = await Promise.all([signUp(), signUp()])
    topic = await createTopic(author)
    post = await createPost(author, topic.id)
    made = (await critique(author, post.id, critiqueConfig(await latestCommit(post.id)))).body
    await createTopic(other)
  })

  it("lists every type of content, each with what it needs to be shown", async () => {
    const res = await api().get("/contents").query({ authorId: author.pid })

    expect(res.status).toBe(200)
    expect(res.body.count).toBe(3)

    const [critiqueItem, postItem, topicItem] = res.body.contents
    expect(critiqueItem).toMatchObject({ id: made.id, type: "critique", post: { id: post.id, title: post.title }, topic: { id: topic.id } })
    expect(postItem).toMatchObject({ id: post.id, type: "post", topic: { id: topic.id, title: topic.title } })
    expect(topicItem).toMatchObject({ id: topic.id, type: "topic", children: [{ id: post.id }], childrenStats: { count: 1 } })
    for (const item of res.body.contents)
      expect(item).not.toHaveProperty("total_count")
  })

  it("pages, and still counts on a page past the end", async () => {
    const page2 = await api().get("/contents").query({ authorId: author.pid, pageSize: 2, page: 2 })
    expect(page2.body.contents.map((content: any) => content.id)).toEqual([topic.id])
    expect(page2.body.count).toBe(3)

    const pastTheEnd = await api().get("/contents").query({ authorId: author.pid, pageSize: 2, page: 5 })
    expect(pastTheEnd.body).toEqual({ contents: [], count: 3 })
  })

  it("is empty for a user without contents", async () => {
    const nobody = await signUp()
    const res = await api().get("/contents").query({ authorId: nobody.pid })

    expect(res.body).toEqual({ contents: [], count: 0 })
  })
})

describe("GET /contents/bookmarked", () => {
  it("lists the user's bookmarks with their count", async () => {
    const [author, reader] = await Promise.all([signUp(), signUp()])
    const topic = await createTopic(author)
    const post = await createPost(author, topic.id)
    await createTopic(author)
    await interact(reader, topic.id, "bookmark")
    await interact(reader, post.id, "bookmark")
    await interact(author, post.id, "bookmark")

    const res = await api().get("/contents/bookmarked").set(reader.auth)

    expect(res.status).toBe(200)
    expect(res.body.count).toBe(2)
    expect(res.body.contents.map((content: any) => content.id)).toEqual([post.id, topic.id])
    expect(res.body.contents[0].userInteractions).toEqual(["bookmark"])

    const pastTheEnd = await api().get("/contents/bookmarked").query({ page: 3 }).set(reader.auth)
    expect(pastTheEnd.body).toEqual({ contents: [], count: 2 })
  })

  it("requires the user to be logged in", async () => {
    expect((await api().get("/contents/bookmarked")).status).toBe(400)
  })
})
