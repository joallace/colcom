import db from "@/database"
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

interface ContentToInsert {
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


async function create({ title, author_pid, parent_id, body, type, config }: ContentToInsert): Promise<Content> {
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
  return { ...result.rows[0], author: name, author_id: author_pid }
}

async function findAll({ where = "", orderBy = "", page = 1, pageSize = 10, values = [] as any[] }): Promise<Content[]> {
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
      ${orderBy ? `ORDER BY ${orderBy}` : ""}
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      ;`,
    values
  }

  const result = await db.query(query)
  return result.rows
}

async function findById(id: number): Promise<Content> {
  const result = await findAll({ where: "contents.id = $1", values: [id], pageSize: 1})
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

async function getType(parent_id: number | null) {
  if (!parent_id)
    return "topic"

  const query = {
    text: `
    SELECT
        parent_id as grandparent_id
    FROM
        contents
    WHERE
      contents.id = $1
    ;`,
    values: [parent_id]
  }

  const result = await db.query(query)
  return result.rows[0].grandparent_id === null ? "post" : "critique"
}

export default Object.freeze({
  create,
  findAll,
  findById,
  getTopicNumberOfVotes,
  getType
})

export { Content as IContent, ContentToInsert as IContentToInsert, ContentType }