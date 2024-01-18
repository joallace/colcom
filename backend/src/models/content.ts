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

interface RegisteringContent {
  title: string,
  author_pid: string,
  parent_id?: string,
  body?: string,
  type: ContentType,
  config?: ConfigType
}

interface Content {
  id: number,
  title: string,
  author: string,
  author_pid: string,
  parent_id?: string,
  body?: string,
  type: ContentType,
  status: string,
  created_at: Date,
  config?: ConfigType
}


export async function create({ title, author_pid, parent_id, body, type, config }: RegisteringContent): Promise<Content> {
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

export async function findAll(): Promise<Content[]> {
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
              SELECT COUNT(*) FROM
                interactions as interaction
              WHERE
                interaction.content_id = contents.id
              AND
                interaction.type = 'promote'
              AND
                interaction.valid_until > now()
            )
            ELSE NULL
          END
        ) as promotions
      FROM
        contents
      INNER JOIN
        users ON contents.author_id = users.id
      ;`,
  }

  const result = await db.query(query)
  return result.rows
}