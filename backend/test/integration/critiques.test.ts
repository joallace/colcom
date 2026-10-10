// A critique's lifecycle (phase 2): the post's author addresses or rebuts it, the critic accepts,
// disputes or withdraws, and a fix the critic suggests resolves it once merged
import { beforeAll, describe, expect, it } from "vitest"

import db from "@/pgDatabase"
import { api, createPost, createTopic, critique, critiqueConfig, edit, latestCommit, signUp, TestUser, unique } from "../support/api"


let author: TestUser, critic: TestUser, outsider: TestUser

beforeAll(async () => {
  [author, critic, outsider] = await Promise.all([signUp(), signUp(), signUp()])
})

// A post by `author` with a critique by `critic` on its first version, and the post edited once since
async function critiqued() {
  const topic = await createTopic(author)
  const post = await createPost(author, topic.id)
  const criticised = await latestCommit(post.id)
  const made = await critique(critic, post.id, critiqueConfig(criticised))
  expect(made.status, JSON.stringify(made.body)).toBe(201)

  expect((await edit(author, post.id, "<p>First paragraph, fixed.</p><p>Second paragraph.</p>")).status).toBe(200)
  return { topic, post, criticised, fix: await latestCommit(post.id), critiqueId: made.body.id as number }
}

const act = (user: TestUser, critiqueId: number, body: object) =>
  api().post(`/contents/${critiqueId}/events`).set(user.auth).send(body)

// The critique as the post page gets it, on the post's latest version
async function shown(postId: number, critiqueId: number) {
  const res = await api().get(`/contents/${postId}/${await latestCommit(postId)}`)
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  return res.body.critiques.find((made: { id: number }) => made.id === critiqueId)
}

const inbox = async (user: TestUser) => (await api().get("/notifications").set(user.auth)).body.notifications

describe("answering a critique", () => {
  it("starts open, without events", async () => {
    const { post, critiqueId } = await critiqued()

    expect(await shown(post.id, critiqueId)).toMatchObject({ status: "open", events: [] })
  })

  it("lets the post's author address it with the version that fixes it, and tells the critic", async () => {
    const { post, fix, critiqueId } = await critiqued()

    const res = await act(author, critiqueId, { action: "address", commit: fix, note: "Reescrevi o trecho." })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body).toMatchObject({
      id: critiqueId,
      status: "addressed",
      events: [{
        action: "address",
        from: "open",
        to: "addressed",
        note: "Reescrevi o trecho.",
        commit: fix,
        actor: { pid: author.pid, name: author.name },
        suggestion: null
      }]
    })
    expect(await shown(post.id, critiqueId)).toMatchObject({ status: "addressed", events: [{ action: "address" }] })

    const [notification] = await inbox(critic)
    expect(notification).toMatchObject({ type: "critique_addressed", content: { id: post.id }, subject: { id: critiqueId } })
  })

  it("addresses it only with a later version of the post", async () => {
    const { topic, criticised, critiqueId } = await critiqued()
    const other = await createPost(author, topic.id)

    for (const commit of [undefined, criticised, await latestCommit(other.id), "--output=/tmp/pwned"]) {
      const res = await act(author, critiqueId, { action: "address", commit })
      expect(res.status, JSON.stringify(res.body)).toBe(400)
      expect(res.body.key).toBe("commit")
    }
  })

  it("needs reasons to rebut or dispute it", async () => {
    const { critiqueId } = await critiqued()

    for (const note of [undefined, "", "   "]) {
      const res = await act(author, critiqueId, { action: "rebut", note })
      expect(res.status, JSON.stringify(res.body)).toBe(400)
      expect(res.body.key).toBe("note")
    }

    expect((await act(author, critiqueId, { action: "rebut", note: "O trecho está correto." })).status).toBe(201)
    expect((await act(critic, critiqueId, { action: "dispute" })).status).toBe(400)
  })

  it("lets only the post's author answer it, and only the critic accept, dispute or withdraw it", async () => {
    const { critiqueId } = await critiqued()
    const note = "Motivo."

    for (const user of [critic, outsider])
      expect((await act(user, critiqueId, { action: "rebut", note })).status).toBe(403)
    expect((await act(author, critiqueId, { action: "rebut", note })).status).toBe(201)

    for (const user of [author, outsider]) {
      expect((await act(user, critiqueId, { action: "accept" })).status).toBe(403)
      expect((await act(user, critiqueId, { action: "withdraw" })).status).toBe(403)
    }
    expect((await act(critic, critiqueId, { action: "accept" })).status).toBe(201)
  })

  it("refuses anonymous actions, unknown actions and contents other than critiques", async () => {
    const { post, critiqueId } = await critiqued()

    // A missing token is a 400, as on every route
    expect((await api().post(`/contents/${critiqueId}/events`).send({ action: "withdraw" })).status).toBe(400)
    expect((await act(critic, critiqueId, { action: "close" })).status).toBe(400)
    expect((await act(author, post.id, { action: "rebut", note: "x" })).status).toBe(404)
    expect((await act(author, 2_000_000_000, { action: "rebut", note: "x" })).status).toBe(404)
  })
})

describe("the critic's answer", () => {
  it("resolves it by accepting, and tells the post's author", async () => {
    const { post, fix, critiqueId } = await critiqued()
    await act(author, critiqueId, { action: "address", commit: fix })

    const res = await act(critic, critiqueId, { action: "accept", note: "Obrigado!" })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    expect(res.body.status).toBe("resolved")
    expect(res.body.events.map((event: { action: string }) => event.action)).toEqual(["address", "accept"])

    expect((await inbox(author))[0]).toMatchObject({ type: "critique_accepted", content: { id: post.id }, subject: { id: critiqueId } })
  })

  it("sends it to review by disputing, from where only withdrawing moves it", async () => {
    const { critiqueId } = await critiqued()
    await act(author, critiqueId, { action: "rebut", note: "Não procede." })

    const disputed = await act(critic, critiqueId, { action: "dispute", note: "Procede, sim." })
    expect(disputed.status, JSON.stringify(disputed.body)).toBe(201)
    expect(disputed.body.status).toBe("in_review")
    expect((await inbox(author))[0]).toMatchObject({ type: "critique_disputed", subject: { id: critiqueId } })

    expect((await act(author, critiqueId, { action: "rebut", note: "De novo." })).status).toBe(409)
    expect((await act(critic, critiqueId, { action: "accept" })).status).toBe(409)

    const withdrawn = await act(critic, critiqueId, { action: "withdraw" })
    expect(withdrawn.body.status).toBe("withdrawn")
    expect((await inbox(author))[0]).toMatchObject({ type: "critique_withdrawn", subject: { id: critiqueId } })
  })

  it("follows the states: nothing to accept before an answer, nothing to do once closed", async () => {
    const { fix, critiqueId } = await critiqued()

    const early = await act(critic, critiqueId, { action: "accept" })
    expect(early.status).toBe(409)
    expect(early.body.message).toBe("Esta crítica está aberta, e não admite esta ação.")

    await act(author, critiqueId, { action: "address", commit: fix })
    expect((await act(author, critiqueId, { action: "address", commit: fix })).status).toBe(409)
    await act(critic, critiqueId, { action: "accept" })

    expect((await act(critic, critiqueId, { action: "withdraw" })).status).toBe(409)
    expect((await act(author, critiqueId, { action: "rebut", note: "x" })).status).toBe(409)
  })

  it("lets one of two simultaneous actions through", async () => {
    const { critiqueId } = await critiqued()
    await act(author, critiqueId, { action: "rebut", note: "Não procede." })

    const answers = await Promise.all([
      act(critic, critiqueId, { action: "accept" }),
      act(critic, critiqueId, { action: "dispute", note: "Procede." }),
      act(critic, critiqueId, { action: "withdraw" })
    ])

    expect(answers.map(answer => answer.status).sort()).toEqual([201, 409, 409])
    const { rows } = await db.query("SELECT COUNT(*)::INT AS count FROM critique_events WHERE critique_id = $1", [critiqueId])
    expect(rows[0].count).toBe(2)
  })
})

describe("a fix suggested by the critic", () => {
  const suggestFix = (user: TestUser, postId: number, critiqueId: number) =>
    api().patch(`/contents/${postId}`).set(user.auth).send({ body: `<p>${unique("Fixed")}</p>`, message: "Corrige o trecho", critique: critiqueId })

  it("is listed on the critique, and resolves it once the author merges it", async () => {
    const { post, critiqueId } = await critiqued()

    const suggested = await suggestFix(critic, post.id, critiqueId)
    expect(suggested.status, JSON.stringify(suggested.body)).toBe(200)
    expect(suggested.body.config).toMatchObject({ critique: critiqueId, accepted: null })
    const commit = suggested.body.config.commit

    expect(await shown(post.id, critiqueId)).toMatchObject({
      status: "open",
      events: [{ action: "suggest", from: "open", to: "open", actor: { pid: critic.pid }, suggestion: { id: suggested.body.id, commit, accepted: null } }]
    })

    // git refuses the adjacent lines, so this goes through merge3
    const merged = await api().post(`/contents/${post.id}/${commit}/merge`).set(author.auth)
    expect(merged.status, JSON.stringify(merged.body)).toBe(204)

    const resolved = await shown(post.id, critiqueId)
    expect(resolved.status).toBe("resolved")
    expect(resolved.events[1]).toMatchObject({
      action: "merge",
      from: "open",
      to: "resolved",
      commit: await latestCommit(post.id),
      actor: { pid: author.pid },
      suggestion: { id: suggested.body.id, accepted: true }
    })
  })

  it("leaves the critique as it is when rejected", async () => {
    const { post, critiqueId } = await critiqued()
    const suggested = await suggestFix(critic, post.id, critiqueId)

    expect((await api().post(`/contents/${post.id}/${suggested.body.config.commit}/reject`).set(author.auth)).status).toBe(200)
    expect(await shown(post.id, critiqueId)).toMatchObject({ status: "open", events: [{ action: "suggest", suggestion: { accepted: false } }] })
  })

  it("doesn't reopen a critique closed before the merge", async () => {
    const { post, critiqueId } = await critiqued()
    const suggested = await suggestFix(critic, post.id, critiqueId)
    await act(critic, critiqueId, { action: "withdraw" })

    expect((await api().post(`/contents/${post.id}/${suggested.body.config.commit}/merge`).set(author.auth)).status).toBe(204)
    expect((await shown(post.id, critiqueId)).status).toBe("withdrawn")
  })

  it("must come from the critic, for an unanswered critique of this post", async () => {
    const { topic, post, fix, critiqueId } = await critiqued()
    const elsewhere = await critiqued()
    const outsiders = await critique(outsider, post.id, critiqueConfig(fix))

    const closed = await critique(critic, post.id, critiqueConfig(fix))
    await act(critic, closed.body.id, { action: "withdraw" })

    const refused = [
      await suggestFix(author, post.id, critiqueId),
      await suggestFix(outsider, post.id, critiqueId),
      await suggestFix(critic, post.id, elsewhere.critiqueId),
      await suggestFix(critic, post.id, outsiders.body.id),
      await suggestFix(critic, post.id, closed.body.id),
      await suggestFix(critic, post.id, topic.id)
    ]

    for (const res of refused) {
      expect(res.status, JSON.stringify(res.body)).toBe(400)
      expect(res.body.key).toBe("critique")
    }
    // None of them was written
    const { body } = await api().get(`/contents/${post.id}`)
    expect(body.interactionCounts.suggestions).toBe(0)
  })
})

describe("the log", () => {
  it("is the only way a critique's state changes, and can't be altered", async () => {
    const { fix, critiqueId } = await critiqued()
    await act(author, critiqueId, { action: "address", commit: fix })

    await expect(db.query("UPDATE contents SET status = 'resolved' WHERE id = $1", [critiqueId])).rejects.toThrow(/critique_events/)
    await expect(db.query("UPDATE critique_events SET note = 'x' WHERE critique_id = $1", [critiqueId])).rejects.toThrow(/append-only/)
    await expect(db.query("DELETE FROM critique_events WHERE critique_id = $1", [critiqueId])).rejects.toThrow(/append-only/)
    await expect(db.query("TRUNCATE critique_events")).rejects.toThrow(/append-only/)
  })
})
