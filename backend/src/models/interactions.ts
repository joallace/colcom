import db from "@/pgDatabase"
import { avatarToBase64, getDataByPublicId } from "@/models/user"
import { ConflictError, ValidationError } from "@/errors"
import Content from "@/models/content"
import { activeInteractionSql, pendingSuggestionSql, promotionValidSql } from "@/models/sql"


// What POST /interactions toggles; suggestions come from edits
type ToggledType = "up" | "down" | "vote" | "bookmark" | "promote"
type InteractionType = ToggledType | "suggestion"

interface PromoteConfig {
  valid_until: string
}

interface SuggestionConfig {
  message: string,
  accepted: boolean | null,
  commit: string
}

type Interaction = {
  id: number,
  author_id: string,
  content_id: number,
  created_at: Date
} & (
  | { type: "up" | "down" | "vote" | "bookmark", config: null }
  | { type: "promote", config: PromoteConfig }
  // Null until the suggestion's commit is written, which needs the interaction's id
  | { type: "suggestion", config: SuggestionConfig | null }
)

interface InteractionInsertRequest {
  author_pid: string,
  content_id: number,
  type: InteractionType
}

// What a toggle did, for the controller to answer with
type ToggleOutcome =
  | { outcome: "created" | "updated", interaction: Interaction }
  | { outcome: "removed" }


// A post's suggestions its author hasn't answered yet, newest first
async function pendingSuggestions(content_id: number): Promise<Interaction[]> {
  const query = {
    text: `
      SELECT
        i.id,
        i.content_id,
        i.type,
        i.config,
        i.created_at,
        users.name as author,
        users.pid as author_id,
        users.avatar as author_avatar
      FROM
        interactions i
      INNER JOIN
        users ON users.id = i.author_id
      WHERE
        i.content_id = $1
      AND
        ${pendingSuggestionSql("i")}
      ORDER BY
        i.id DESC
      ;`,
    values: [content_id]
  }

  const result = await db.query(query)
  avatarToBase64("author_avatar", result)
  return result.rows
}

// The user's interactions with a content that still count (not expired promotions)
async function getUserContentInteractions(author_pid: string, content_id: number): Promise<Pick<Interaction, "id" | "type" | "config">[]> {
  const query = {
    text: `
      SELECT
        i.id,
        i.type,
        i.config
      FROM
        interactions i
      INNER JOIN
        users ON users.pid = $1
      WHERE
        i.author_id = users.id
      AND
        i.content_id = $2
      AND
        ${activeInteractionSql("i")}
      ;`,
    values: [author_pid, content_id]
  }

  const results = await db.query(query)

  return results.rows
}

async function getUserTopicVote(author_pid: string, topic_id: number): Promise<Pick<Interaction, "id" | "content_id"> | undefined> {
  const query = {
    text: `
    SELECT
      i.id,
      i.content_id
    FROM
      interactions i
    INNER JOIN
      users ON users.id = i.author_id
    INNER JOIN
      contents ON contents.id = i.content_id
    WHERE
      i.type = 'vote'
    AND
      users.pid = $1
    AND
      contents.parent_id = $2
    LIMIT 1
    ;`,
    values: [author_pid, topic_id]
  }

  const result = await db.query(query)
  return result.rows[0]
}

async function getUserCurrentPromote(author_pid: string): Promise<Pick<Interaction, "id" | "content_id"> | undefined> {
  const query = {
    text: `
    SELECT
      i.id,
      i.content_id
    FROM
      interactions i
    INNER JOIN
      users ON users.id = i.author_id
    WHERE
      i.type = 'promote'
    AND
      users.pid = $1
    AND
      ${promotionValidSql("i")}
    LIMIT 1
    ;`,
    values: [author_pid]
  }

  const result = await db.query(query)
  return result.rows[0]
}

// up and down are exclusive: the other one is turned over rather than added
const OPPOSITE = { up: "down", down: "up" } as const

// Toggles a user's interaction with a content: the same one again withdraws it. An opposite relevance
// vote is turned over, and a poll vote or promotion elsewhere is moved, since a user has one of each
// per topic and per day.
async function toggle({ author_pid, content_id, type }: { author_pid: string, content_id: number, type: ToggledType }): Promise<ToggleOutcome> {
  // A 404 when the content doesn't exist, instead of a foreign key violation (500) on insert
  const content = await Content.getFieldsOrThrow(content_id, ["parent_id", "type"])
  const current = await getUserContentInteractions(author_pid, content_id)

  const same = current.find(interaction => interaction.type === type)
  if (same) {
    await removeById(same.id)
    return { outcome: "removed" }
  }

  if (type === "up" || type === "down") {
    const opposite = current.find(interaction => interaction.type === OPPOSITE[type])
    if (opposite)
      return { outcome: "updated", interaction: await setType(opposite.id, type, author_pid) }
  }

  if (type === "vote") {
    // The vote_events trigger also refuses them, but with a 500
    if (content.type !== "post")
      throw new ValidationError({
        message: "Só é possível votar em posts.",
        action: "Escolha o post que defende a sua resposta.",
        errorLocationCode: "MODEL:INTERACTION:HANDLE:VOTE_NOT_ON_POST"
      })

    const previous = await getUserTopicVote(author_pid, content.parent_id)
    if (previous)
      return { outcome: "updated", interaction: await moveTo(previous.id, content_id, author_pid) }
  }

  if (type === "promote") {
    const previous = await getUserCurrentPromote(author_pid)
    if (previous)
      return { outcome: "updated", interaction: await moveTo(previous.id, content_id, author_pid) }
  }

  return { outcome: "created", interaction: await create({ author_pid, content_id, type }) }
}

async function create({ author_pid, content_id, type }: InteractionInsertRequest): Promise<Interaction> {
  const { id } = await getDataByPublicId(author_pid, ["id"])

  // if (type === "promote" && (!colcoins || authorBalance < colcoins || colcoins < minimumPromoteValue))
  //   throw new ValidationError({
  //     message: "Quantidade de colcoins insuficiente para realizar a ação.",
  //     action: "Atue na comunidade para ganhar mais colcoins!",
  //     errorLocationCode: 'MODEL:INTERACTION:CREATE:INSUFFICIENT_BALANCE'
  //   })

  const promoteConfig = () => ({ valid_until: new Date(new Date().setHours(23, 59, 59, 999)) })

  const query = {
    text: `
      INSERT INTO
        interactions(
          author_id,
          content_id,
          type,
          config
        )
      VALUES
        ($1, $2, $3, $4)
      RETURNING
        *
      ;`,
    values: [id, content_id, type, type === "promote" ? promoteConfig() : null]
  }

  const result = await db.query(query).catch(err => {
    // unique_violation: an identical request (e.g. a double click) already registered it
    if (err?.code === "23505")
      throw new ConflictError({
        message: "Esta interação já foi registrada.",
        action: "Atualize a página para ver o estado atual.",
        errorLocationCode: "MODEL:INTERACTION:CREATE:ALREADY_EXISTS"
      })
    throw err
  })

  return { ...result.rows[0], author_id: author_pid }
}

// An updated row, its author as the API shows it (the pid, not the internal id)
const updated = async (query: { text: string, values: unknown[] }, author_pid: string): Promise<Interaction> => {
  const result = await db.query(query)
  return { ...result.rows[0], author_id: author_pid }
}

// Turns a relevance vote over
const setType = (id: number, type: "up" | "down", author_pid: string) =>
  updated({ text: "UPDATE interactions SET type = $1 WHERE id = $2 RETURNING *;", values: [type, id] }, author_pid)

// Moves a poll vote or a promotion to another content
const moveTo = (id: number, content_id: number, author_pid: string) =>
  updated({ text: "UPDATE interactions SET content_id = $1 WHERE id = $2 RETURNING *;", values: [content_id, id] }, author_pid)

// Records a suggestion's commit once git has written it, pending the author's answer
const setSuggestionCommit = (id: number, { message, commit }: { message: string, commit: string }, author_pid: string) => {
  const config: SuggestionConfig = { message, commit, accepted: null }
  return updated({ text: "UPDATE interactions SET config = $1 WHERE id = $2 RETURNING *;", values: [config, id] }, author_pid)
}

async function findPendingSuggestion(content_id: number, commit: string): Promise<Interaction | undefined> {
  const query = {
    text: `
      SELECT
        *
      FROM
        interactions
      WHERE
        content_id = $1
      AND
        ${pendingSuggestionSql("interactions")}
      AND
        config->>'commit' = $2
      LIMIT 1
      ;`,
    values: [content_id, commit]
  }

  const result = await db.query(query)
  return result.rows[0]
}

async function setSuggestionAccepted(id: number, accepted: boolean, author_pid: string): Promise<Interaction> {
  const query = {
    text: `
      UPDATE
        interactions
      SET
        config = jsonb_set(config, '{accepted}', to_jsonb($1::BOOLEAN))
      WHERE
        id = $2
      RETURNING
        *
      ;`,
    values: [accepted, id]
  }

  const result = await db.query(query)
  return { ...result.rows[0], author_id: author_pid }
}


interface VoteEvent {
  id: number,
  voter: number,
  from: number | null,
  to: number | null,
  created_at: Date
}

// A topic's poll history, oldest first. Voters are numbered per topic in order of their first vote
// rather than named, until the sign-up asks for consent to public votes (TODO.md).
async function findVoteHistory(topic_id: number): Promise<VoteEvent[]> {
  const query = {
    text: `
      SELECT
        e.id::int,
        DENSE_RANK() OVER (ORDER BY first.id)::int AS voter,
        e.from_content_id AS "from",
        e.to_content_id AS "to",
        e.created_at
      FROM
        vote_events e
      INNER JOIN LATERAL (
        SELECT MIN(f.id) AS id FROM vote_events f WHERE f.topic_id = e.topic_id AND f.user_id = e.user_id
      ) first ON true
      WHERE
        e.topic_id = $1
      ORDER BY
        e.id
      ;`,
    values: [topic_id]
  }

  const result = await db.query(query)
  return result.rows
}

async function removeById(interaction_id: number) {
  const query = {
    text: `
      DELETE FROM
        interactions
      WHERE
        interactions.id = $1
      ;`,
    values: [interaction_id]
  }

  await db.query(query)
  return {}
}

export default Object.freeze({
  toggle,
  create,
  getUserContentInteractions,
  getUserCurrentPromote,
  getUserTopicVote,
  pendingSuggestions,
  setSuggestionCommit,
  findPendingSuggestion,
  setSuggestionAccepted,
  findVoteHistory,
  removeById
})

export { Interaction, InteractionType, ToggleOutcome }