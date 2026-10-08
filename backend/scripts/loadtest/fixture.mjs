// The data every scenario runs against, created through the API before any phase is measured.

export const USERS = 80
// Authors of the hot topic's posts and of the single-post topics; one per virtual user, so a
// scenario can give each user a post of their own. The users after them only suggest.
export const AUTHORS = 64
const READ_POSTS = 8
const PASS = "loadtest-password"
// A 1x1 PNG, the smallest valid avatar
const AVATAR = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="

let sequence = 0
// Titles and names are unique site-wide; a run against a used database still gets fresh ones
const runId = Date.now().toString(36)
export const unique = prefix => `${prefix} ${runId}-${++sequence}`

const SENTENCES = [
  "A participação direta exige informação clara e regras que qualquer pessoa consiga verificar.",
  "Orçamentos participativos mostraram que cidadãos priorizam saneamento, saúde e transporte.",
  "Sem transparência sobre os custos, qualquer proposta parece gratuita e ninguém discute prioridades.",
  "O histórico de cada versão permite auditar quem mudou o quê e por quê, como um registro público.",
  "Críticas pontuais a trechos específicos tendem a ser mais produtivas do que respostas genéricas.",
  "Uma síntese só convence quando incorpora os melhores argumentos de cada lado do debate."
]

// A post of six paragraphs (about 600 bytes, a typical post) whose first paragraph carries
// `marker`, so each edit changes the post's summary, which Postgres keeps apart from git
export const paragraphs = marker => [`Versão ${marker}: ${SENTENCES[0]}`, ...SENTENCES.slice(1)]
export const html = list => list.map(text => `<p>${text}</p>`).join("")
export const document = marker => html(paragraphs(marker))

// The anchor the post page makes when `exact` is selected in a document of plain paragraphs (see seed.mjs)
export function anchor(list, exact) {
  const text = list.join("\n")
  const at = text.indexOf(exact)
  const position = offset => {
    let pos = 1
    for (const paragraph of list) {
      if (offset <= paragraph.length)
        return pos + offset
      offset -= paragraph.length + 1
      pos += paragraph.length + 2
    }
  }
  const end = at + exact.length
  return { from: position(at), to: position(end - 1) + 1, quote: { exact, prefix: text.slice(Math.max(0, at - 32), at), suffix: text.slice(end, end + 32), start: at } }
}

// Runs `task` over `items` with at most `limit` in flight, keeping the order of the results
async function pool(items, limit, task) {
  const results = new Array(items.length)
  let next = 0
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++
      results[index] = await task(items[index], index)
    }
  }))
  return results
}

export async function createFixture({ must }, ledger, log) {
  const users = await pool(Array.from({ length: USERS }), 8, async () => {
    const name = unique("lt").replace(/[\s-]/g, "_")
    const created = await must("POST", "/users", { body: { name, email: `${name}@loadtest.colcom`, pass: PASS, avatar: AVATAR } })
    const { accessToken } = await must("POST", "/login", { body: { login: name, pass: PASS } })
    return { name, pid: created.pid, token: accessToken }
  })
  log(`${users.length} users`)

  const topic = (user, title) => must("POST", "/contents", { token: user.token, body: { title: unique(title), body: html([SENTENCES[0]]), config: { answers: ["sim", "não"] } } })
  const post = async (user, topicId, marker) => {
    const created = await must("POST", "/contents", { token: user.token, body: { title: unique("Post"), body: document(marker), parent_id: topicId, config: { answer: "sim" } } })
    const [{ commit }] = (await must("GET", `/contents/${created.id}`)).history
    ledger.landed(topicId, created.id, commit)
    return { id: created.id, topicId, author: user, commit, marker }
  }
  const edit = async (target, marker) => {
    const { commit } = await must("PATCH", `/contents/${target.id}`, { token: target.author.token, body: { body: document(marker), message: `Edição ${marker}` } })
    ledger.landed(target.topicId, target.id, commit)
    target.marker = marker
    return commit
  }

  // Reads: posts with a history of edits, critiques on earlier versions (so reading the latest one
  // sends the lineages and the texts in between) and a pending suggestion
  const readTopic = await topic(users[0], "Leitura")
  const readPosts = await pool(users.slice(0, READ_POSTS), 4, async (author, index) => {
    const target = await post(author, readTopic.id, `r${index}.0`)
    const versions = [target.commit]
    for (let version = 1; version <= 3; version++)
      versions.push(await edit(target, `r${index}.${version}`))
    for (const [k, commit] of versions.slice(0, 3).entries()) {
      const critic = users[(index + k + 1) % USERS]
      const list = paragraphs(`r${index}.${k}`)
      await must("POST", "/contents", { token: critic.token, body: { title: unique("Crítica"), body: html(["Faltam fontes para essa afirmação."]), parent_id: target.id, config: { commit, ...anchor(list, SENTENCES[2]) } } })
    }
    const suggester = users[AUTHORS + (index % (USERS - AUTHORS))]
    const suggestion = await must("PATCH", `/contents/${target.id}`, { token: suggester.token, body: { body: document(`r${index}.s`), message: "Sugestão" } })
    ledger.suggested(readTopic.id, target.id, suggestion.id, suggestion.config.commit)
    return { ...target, tip: versions.at(-1), suggestion: suggestion.config.commit }
  })
  log(`read topic ${readTopic.id}: ${readPosts.length} posts with 3 edits, 3 critiques and a suggestion each`)

  // Writes: a topic with one post per author (many branches in one repo), and one topic per author
  // with a single post (many repos)
  const hotTopic = await topic(users[0], "Concorrido")
  const hotPosts = await pool(users.slice(0, AUTHORS), 8, (author, index) => post(author, hotTopic.id, `h${index}.0`))
  log(`hot topic ${hotTopic.id}: ${hotPosts.length} posts`)

  const spreadPosts = await pool(users.slice(0, AUTHORS), 8, async (author, index) => post(author, (await topic(author, "Espalhado")).id, `s${index}.0`))
  log(`${spreadPosts.length} topics with one post each`)

  const createTopic = await topic(users[0], "Criação")

  return { users, readTopic, readPosts, hotTopic, hotPosts, spreadPosts, createTopic }
}
