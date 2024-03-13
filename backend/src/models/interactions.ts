import db from "@/pgDatabase"
import { getDataByPublicId } from "@/models/user"
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
        users.pid as author_id
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

async function handleChange({ author_pid, content_id, type }: InteractionInsertRequest): Promise<Array<any>> {
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
      const { parent_id } = await Content.getDataById(content_id, ["parent_id"])
      const oldVoteId = (await getUserTopicVote(author_pid, parent_id))?.id

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
        stack: new Error().stack,
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
  //     stack: new Error().stack,
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

  const result = await db.query(query)

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

async function updateByCommit(commit: string, field: string, data: any, author_pid: string): Promise<Interaction> {
  if (!/^[0-9a-f]{7}$/.test(commit))
    throw new ValidationError({
      message: `Hash de commit inválido.`,
      action: 'Forneça um hash de commit válido.',
      stack: new Error().stack
    })

  const query = {
    text: `
      UPDATE
        interactions
      SET
        ${field} = '${data}'
      WHERE
        config['commit'] = '"${commit}"'
      RETURNING
        *
      ;`
  }

  const result = await db.query(query)
  return { ...result.rows[0], author_id: author_pid }
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
  updateById,
  updateByCommit,
  removeById
})

export { InteractionInsertRequest, InteractionAlterRequest }