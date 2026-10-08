// Each scenario is one virtual user's iteration, repeated by every virtual user for the length of a
// phase (a closed loop: a user sends its next request when the previous one is answered). The write
// scenarios differ in what concurrent writes share, which is what the git layer serializes or races on:
// one branch, one repo with many branches, or many repos.
import { AUTHORS, USERS, anchor, document, paragraphs, unique } from "./fixture.mjs"

const pick = list => list[Math.floor(Math.random() * list.length)]

// What a reader does: the topic list, a topic, a post with its history, and the latest version of a
// post, which also reads every earlier version critiques were made on. Half of them logged in.
async function read({ call, fixture, vu }) {
  const token = Math.random() < 0.5 ? fixture.users[vu % USERS].token : undefined
  const target = pick(fixture.readPosts)
  switch (Math.floor(Math.random() * 4)) {
    case 0: return call("GET /topics", "GET", "/topics?pageSize=10", { token })
    case 1: return call("GET /topics/:id", "GET", `/topics/${fixture.readTopic.id}`, { token })
    case 2: return call("GET /contents/:id", "GET", `/contents/${target.id}`, { token })
    case 3: return call("GET /contents/:id/:hash", "GET", `/contents/${target.id}/${target.tip}`, { token })
  }
}

let edits = 0
// An author's edit, with a first paragraph no other edit has
async function edit({ call, ledger }, label, target) {
  const marker = `e${++edits}`
  const res = await call(label, "PATCH", `/contents/${target.id}`, { token: target.author.token, body: { body: document(marker), message: `Edição ${marker}` } })
  if (res.ok)
    ledger.landed(target.topicId, target.id, res.data.commit)
  return res
}

export const scenarios = {
  read: {
    description: "Reads only: topic list, a topic, a post with its history, a version with its critiques' lineages",
    iteration: read
  },

  "edit-same-post": {
    description: "Every virtual user edits the same post, as its author: writes racing for one branch",
    iteration: ctx => edit(ctx, "PATCH /contents/:id", ctx.fixture.hotPosts[0])
  },

  "edit-same-topic": {
    description: "Each virtual user edits its own post, all in one topic: one repo, a branch per writer",
    maxConcurrency: AUTHORS,
    iteration: ctx => edit(ctx, "PATCH /contents/:id", ctx.fixture.hotPosts[ctx.vu])
  },

  "edit-many-topics": {
    description: "Each virtual user edits its own post in its own topic: a repo per writer",
    maxConcurrency: AUTHORS,
    iteration: ctx => edit(ctx, "PATCH /contents/:id", ctx.fixture.spreadPosts[ctx.vu])
  },

  "suggest-merge": {
    description: "Each virtual user suggests an edit to its own post in one topic, which the author then accepts (a merge)",
    maxConcurrency: AUTHORS,
    iteration: async ({ call, fixture, ledger, vu }) => {
      const target = fixture.hotPosts[vu]
      const suggester = fixture.users[AUTHORS + (vu % (USERS - AUTHORS))]
      const marker = `m${++edits}`
      const suggestion = await call("PATCH /contents/:id (suggestion)", "PATCH", `/contents/${target.id}`, { token: suggester.token, body: { body: document(marker), message: `Sugestão ${marker}` } })
      if (!suggestion.ok)
        return
      const { commit } = suggestion.data.config
      ledger.suggested(target.topicId, target.id, suggestion.data.id, commit)
      const merge = await call("POST /contents/:id/:hash/merge", "POST", `/contents/${target.id}/${commit}/merge`, { token: target.author.token })
      if (merge.ok)
        ledger.landed(target.topicId, target.id, commit)
    }
  },

  "create-posts": {
    description: "Virtual users create posts in the same topic: new branches in one repo",
    iteration: async ({ call, fixture, ledger, vu }) => {
      const author = fixture.users[vu % USERS]
      const res = await call("POST /contents (post)", "POST", "/contents", { token: author.token, body: { title: unique("Novo"), body: document(unique("n")), parent_id: fixture.createTopic.id, config: { answer: "não" } } })
      if (res.ok)
        ledger.createdPosts.push({ topicId: fixture.createTopic.id, id: res.data.id })
    }
  },

  // Roughly what a forum sees: mostly reading, some voting, fewer edits and critiques. Edits go to
  // each user's own post, as authors don't usually edit at the same time.
  mixed: {
    description: "75% reads, 12% relevance and poll votes, 10% edits of one's own post, 3% critiques",
    maxConcurrency: AUTHORS,
    iteration: async ctx => {
      const { call, fixture, vu } = ctx
      const user = fixture.users[vu]
      const roll = Math.random()
      if (roll < 0.75)
        return read(ctx)
      if (roll < 0.87) {
        const vote = Math.random() < 0.5
        return call("POST /interactions", "POST", "/interactions", { token: user.token, body: { content_id: pick(vote ? fixture.readPosts : fixture.hotPosts).id, type: vote ? "vote" : "up" } })
      }
      if (roll < 0.97)
        return edit(ctx, "PATCH /contents/:id", fixture.spreadPosts[vu])
      const target = pick(fixture.readPosts)
      return call("POST /contents (critique)", "POST", "/contents", {
        token: user.token,
        body: { title: unique("Crítica"), body: "<p>Discordo deste trecho.</p>", parent_id: target.id, config: { commit: target.tip, ...anchor(paragraphs(target.marker), "registro público") } }
      })
    }
  }
}
