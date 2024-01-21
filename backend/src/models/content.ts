import db from "@/database"
import logger from "@/logger"
import { NotFoundError, ValidationError } from "@/errors"
import { getDataByPublicId } from "@/models/user"


type ContentType = "topic" | "post" | "critique"

interface TopicConfig {
  answers: string[]
}

interface PostConfig {
  answer: string
}

interface CritiqueConfig {
  commit: string,
  from: number,
  to: number,
}

type ConfigType = TopicConfig | PostConfig | CritiqueConfig

interface ContentInsertRequest {
  title: string,
  author_pid: string,
  parent_id?: number,
  body?: string,
  type: ContentType,
  config?: ConfigType,
  [key: string]: string | number | ContentType | ConfigType | undefined
}

interface Content {
  id: number,
  title: string,
  author: string,
  author_pid: string,
  parent_id?: number,
  body?: string,
  type: ContentType,
  status: string,
  created_at: Date,
  config?: ConfigType
}


async function create({ title, author_pid, parent_id, body, type, config }: ContentInsertRequest): Promise<Content> {
  if (!/^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/.test(author_pid))
    throw new ValidationError({
      message: 'O campo "author_pid" não é um uuid válido.'
    })

  const { id, name } = await getDataByPublicId(author_pid, ["id", "name"])

  const query = {
    text: `
      INSERT INTO
        contents(
          title,
          author_id,
          parent_id,
          body,
          type,
          config
        )
      VALUES
          ($1, $2, $3, $4, $5, $6)
      RETURNING
        *
    ;`,
    values: [
      title,
      id,
      parent_id,
      body,
      type,
      config
    ],
  }

  const result = await db.query(query)
  logger.info(result)
  return { ...result.rows[0], author: name, author_id: author_pid }
}

async function findAll({ where = "", orderBy = "id", page = 1, pageSize = 10, values = [] as any[] }): Promise<Content[]> {
  logger.info(`GET with LIMIT ${pageSize} and OFFSET ${(page - 1) * pageSize}, page=${page}`)
  const query = {
    text: `
      SELECT
        contents.id,
        contents.title,
        contents.parent_id,
        contents.body,
        contents.type,
        contents.status,
        contents.created_at,
        contents.config,
        users.pid as author_id,
        users.name as author,
        (
          SELECT COUNT(*) FROM
            interactions as interaction
          WHERE
            interaction.content_id = contents.id
          AND
            interaction.type = 'up'
        ) as upvotes,
        (
          SELECT COUNT(*) FROM
            interactions as interaction
          WHERE
            interaction.content_id = contents.id
          AND
            interaction.type = 'down'
        ) as downvotes,
        (
          CASE
            WHEN
              contents.type = 'topic'
            THEN (
              SELECT
                COUNT(*)
              FROM
                interactions as interaction
              WHERE
                interaction.content_id = contents.id
              AND
                interaction.type = 'promote'
              AND
                interaction.valid_until > NOW()
            )
            ELSE NULL
          END
        ) as promotions
      FROM
        contents
      INNER JOIN
        users ON contents.author_id = users.id
      ${where ? `WHERE ${where}` : ""}
      ORDER BY ${orderBy} DESC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      ;`,
    values
  }

  const result = await db.query(query)
  return result.rows
}

async function findById(id: number): Promise<Content> {
  const result = await findAll({ where: "contents.id = $1", values: [id], pageSize: 1 })
  return result[0]
}

async function getTopicNumberOfVotes(topic_id: number): Promise<number> {
  const query = {
    text: `
      SELECT
        COUNT(*)
      FROM
        interactions
      WHERE
        interactions.type = 'favorite'
      AND
        interactions.content_id
      IN
        (
          SELECT
            id
          FROM
            contents
          WHERE
            contents.parent_id = $1
        )
    ;`,
    values: [topic_id]
  }

  const result = await db.query(query)
  return result.rows[0].count
}

export async function getDataById(id: number, data: (keyof Content)[]): Promise<any> {
  const query = {
    text: `
      SELECT
        ${data.join()}
      FROM
        contents
      WHERE
        contents.id = $1
      ;`,
    values: [id],
  }

  const result = await db.query(query)

  if (result.rowCount === 0) {
    throw new NotFoundError({
      message: `O usuário com "public_id" de valor "${id}" não foi encontrado no sistema.`,
      action: 'Verifique se o "public_id" do usuário está digitado corretamente.',
      stack: new Error().stack,
    })
  }
  return result.rows[0]
}

export default Object.freeze({
  create,
  findAll,
  findById,
  getTopicNumberOfVotes,
  getDataById
})

export { Content as IContent, ContentInsertRequest, ContentType }