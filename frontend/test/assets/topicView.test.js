import { describe, expect, it } from "vitest"

import { GROUPED, RANKED, groupByAnswer, loadTopicView, saveTopicView } from "@/assets/topicView"


describe("groupByAnswer", () => {
  const posts = [
    { id: 1, votes: 3, config: { answer: "não" } },
    { id: 2, votes: 1, config: { answer: "sim" } },
    { id: 3, votes: 0, config: { answer: "não" } }
  ]
  const stats = { votes: 8, answers: { "sim": { count: 4, votes: 5 }, "não": { count: 2, votes: 3 } } }

  it("keeps the topic's order of answers and each post's rank in the vote ordering", () => {
    const groups = groupByAnswer(["sim", "não", "talvez"], posts, stats)

    expect(groups.map(group => group.answer)).toEqual(["sim", "não", "talvez"])
    expect(groups[0].posts).toEqual([{ post: posts[1], rank: 1 }])
    expect(groups[1].posts).toEqual([{ post: posts[0], rank: 0 }, { post: posts[2], rank: 2 }])
  })

  it("takes totals from the stats of all posts, not from the posts it was given", () => {
    const [sim, nao, talvez] = groupByAnswer(["sim", "não", "talvez"], posts, stats)

    expect(sim).toMatchObject({ count: 4, votes: 5, percentage: 5 / 8 })
    expect(nao).toMatchObject({ count: 2, votes: 3, percentage: 3 / 8 })
    expect(talvez).toMatchObject({ count: 0, votes: 0, percentage: 0, posts: [] })
  })

  it("gives 0% to every answer of a poll without votes", () => {
    const groups = groupByAnswer(["sim", "não"], [], { votes: 0, answers: {} })

    expect(groups.map(group => group.percentage)).toEqual([0, 0])
  })
})

describe("the remembered view", () => {
  it("ranks by votes until the reader picks the grouped view", () => {
    expect(loadTopicView()).toBe(RANKED)
    saveTopicView(GROUPED)
    expect(loadTopicView()).toBe(GROUPED)
  })

  it("ignores values it doesn't know", () => {
    localStorage.setItem("topicView", "sideways")
    expect(loadTopicView()).toBe(RANKED)
  })
})
