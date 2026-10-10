import db from "@/pgDatabase"
import { avatarToBase64, getDataByPublicId } from "@/models/user"
import { ValidationError } from "@/errors"
import Content from "@/models/content"


type InteractionType = "up" | "down" | "vote" | "bookmark" | "promote" | "suggestion"

interface PromoteConfig {
  valid_until: Date
}

interface SuggestionConfig {
  message: string,
  accepted: boolean | null,
  commit: string
}

type ConfigType = PromoteConfig | SuggestionConfig | null

interface InteractionInsertRequest {
  author_pid: string,
  content_id: number,
  type?: InteractionType,
  config?: ConfigType
}

interface InteractionAlterRequest {
  id: number,
  field: keyof Interaction,
  author_pid: string,
  type?: InteractionType,
  config?: ConfigType,
  content_id?: number
}

interface Interaction {
  id: number,
  author_id: string,
  content_id: number
  type: InteractionType,
  config: ConfigType,
  created_at: Date
}


async function findAll({ where = "", values = [] as any[], orderBy = "" }): Promise<Interaction[]> {
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
      WHERE ${where}
      ${orderBy ? `ORDER BY ${orderBy}` : ""}
      ;`,
    values
  }

  const result = await db.query(query)
  avatarToBase64("author_avatar", result)
  return result.rows
}

async function getUserContentInteractions({ author_pid, content_id }: InteractionInsertRequest): Promise<Interaction[]> {
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
      AND(
        i.config IS NULL
        OR
        i.config->>'valid_until' IS NULL
        OR
        (i.config->>'valid_until')::TIMESTAMP WITH TIME ZONE > NOW()
      )
      ;`,
    values: [author_pid, content_id]
  }

  const results = await db.query(query)

  return results.rows
}

async function getUserTopicVote(author_pid: string, topic_id: number): Promise<Interaction> {
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

async function getUserCurrentPromote(author_pid: string): Promise<Interaction> {
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
      (i.config->>'valid_until')::TIMESTAMP WITH TIME ZONE > NOW()
    LIMIT 1
    ;`,
    values: [author_pid]
  }

  const result = await db.query(query)
  return result.rows[0]
}

async function getCount(where: string, values: Array<any>, join = ""): Promise<any> {
  const query = {
    text: `
      SELECT
        COUNT(*)::int
      FROM
        interactions
      ${join}
      WHERE
        ${where}
      ;`,
    values,
  }

  const result = await db.query(query)

  return result.rows[0].count
}

async function handleChange({ author_pid, content_id, type }: InteractionInsertRequest): Promise<Array<any>> {
  // A 404 when the content doesn't exist, instead of a foreign key violation (500) on insert
  const content = await Content.getDataById(content_id, ["parent_id", "type"])
  const postInteractions = await getUserContentInteractions({ author_pid, content_id, type })

  switch (type) {
    case "down":
      for (const interaction of postInteractions) {
        if (interaction.type === "up")
          return [200, await updateById({ id: interaction.id, field: "type", type, author_pid })]
        if (interaction.type === "down")
          return [204, await removeById(interaction.id)]
      }
      break
    case "up":
      for (const interaction of postInteractions) {
        if (interaction.type === "down")
          return [200, await updateById({ id: interaction.id, field: "type", type, author_pid })]
        if (interaction.type === "up")
          return [204, await removeById(interaction.id)]
      }
      break
    case "vote":
      for (const interaction of postInteractions) {
        if (interaction.type === "vote")
          return [204, await removeById(interaction.id)]
      }
      // The vote_events trigger also refuses them, but with a 500
      if (content.type !== "post")
        throw new ValidationError({
          message: "Só é possível votar em posts.",
          action: "Escolha o post que defende a sua resposta.",
          errorLocationCode: "MODEL:INTERACTION:HANDLE:VOTE_NOT_ON_POST"
        })

      const oldVoteId = (await getUserTopicVote(author_pid, content.parent_id))?.id

      if (oldVoteId)
        return [200, await updateById({ id: oldVoteId, field: "content_id", content_id, author_pid })]

      break
    case "bookmark":
      for (const interaction of postInteractions) {
        if (interaction.type === "bookmark")
          return [204, await removeById(interaction.id)]
      }
      break
    case "promote":
      for (const interaction of postInteractions) {
        if (interaction.type === "promote" && (new Date((<PromoteConfig>interaction.config)?.valid_until) > new Date()))
          return [204, await removeById(interaction.id)]
      }
      const oldPromoteId = (await getUserCurrentPromote(author_pid))?.id

      if (oldPromoteId)
        return [200, await updateById({ id: oldPromoteId, field: "content_id", content_id, author_pid })]
      break
    default:
      throw new ValidationError({
        message: `O tipo de interação "${type}" não é válido.`,
        errorLocationCode: 'MODEL:INTERACTION:HANDLE:INVALID_TYPE'
      })
  }

  return [201, await create({ author_pid, content_id, type })]
}

async function create({ author_pid, content_id, type, config = null }: InteractionInsertRequest): Promise<Interaction> {
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
    values: [id, content_id, type, type === "promote" ? promoteConfig() : config]
  }

  const result = await db.query(query).catch(err => {
    // unique_violation: an identical request (e.g. a double click) already registered it
    if (err?.code === "23505")
      throw new ValidationError({
        message: "Esta interação já foi registrada.",
        action: "Atualize a página para ver o estado atual.",
        statusCode: 409,
        errorLocationCode: "MODEL:INTERACTION:CREATE:ALREADY_EXISTS"
      })
    throw err
  })

  return { ...result.rows[0], author_id: author_pid }
}

async function updateById({ id, field, type, content_id, config, author_pid }: InteractionAlterRequest): Promise<Interaction> {
  const query = {
    text: `
      UPDATE
        interactions
      SET
        ${field} = $1
      WHERE
        id = $2
      RETURNING
        *
      ;`,
    values: [content_id || type || config, id]
  }

  const result = await db.query(query)
  return { ...result.rows[0], author_id: author_pid }
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
        type = 'suggestion'
      AND
        config->>'commit' = $2
      AND
        config->>'accepted' IS NULL
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
  findAll,
  handleChange,
  create,
  getUserContentInteractions,
  getUserTopicVote,
  getUserCurrentPromote,
  getCount,
  updateById,
  findPendingSuggestion,
  setSuggestionAccepted,
  findVoteHistory,
  removeById
})

export { InteractionInsertRequest, InteractionAlterRequest }