// The home page's topic list. In a file of its own, so the database holds only its topics.
import { beforeAll, describe, expect, it } from "vitest"

import { api, createPost, createTopic, signUp, TestUser } from "../support/api"


describe("GET /topics", () => {
  let author: TestUser
  const topicIds: number[] = []

  beforeAll(async () => {
    author = await signUp()
    for (let i = 0; i < 3; i++) {
      const topic = await createTopic(author)
      topicIds.push(topic.id)
      for (let j = 0; j <= i + 2; j++)
        await createPost(author, topic.id)
    }
  })

  it("crops each topic to its 3 best posts, with stats over all of them", async () => {
    const res = await api().get("/topics").query({ orderBy: "id", pageSize: 100 })
    const busiest = res.body.tree.find((topic: any) => topic.id === topicIds[2])

    expect(res.status).toBe(200)
    expect(busiest.children).toHaveLength(3)
    expect(busiest.childrenStats.count).toBe(5)
  })

  it("pages, newest first, and counts topics on request", async () => {
    const first = await api().get("/topics").query({ orderBy: "id", pageSize: 2, page: 1, with_count: "" })
    const second = await api().get("/topics").query({ orderBy: "id", pageSize: 2, page: 2 })

    expect(first.body.tree.map((topic: any) => topic.id)).toEqual([topicIds[2], topicIds[1]])
    expect(second.body.tree.map((topic: any) => topic.id)).toEqual([topicIds[0]])
    expect(first.body.count).toBe(3)
    expect(second.body.count).toBeUndefined()
  })

  it("clamps absurd page sizes", async () => {
    const res = await api().get("/topics").query({ pageSize: 1e9, page: -5 })
    expect(res.status).toBe(200)
    expect(res.body.tree.length).toBeLessThanOrEqual(100)
  })

  it("refuses unknown sort keys", async () => {
    const res = await api().get("/topics").query({ orderBy: "title" })
    expect(res.status).toBe(400)
    expect(res.body.key).toBe("orderBy")
  })
})
