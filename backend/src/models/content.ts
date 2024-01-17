import db from "@/database"
import { getDataByPublicId } from "@/models/user"


type ContentType = "topic" | "post" | "critique"

interface TopicConfig {
  answers: string[]
}

interface CritiqueConfig {
  commit: string,
  from: number,
  to: number,
}

interface RegisteringContent {
  title: string,
  author_pid: string,
  parent_id?: string,
  body?: string,
  type: ContentType,
  config?: TopicConfig | CritiqueConfig
}

interface Content {
  id: number,
  title: string,
  author_pid: string,
  parent_id?: string,
  body?: string,
  type: ContentType,
  status: string,
  created_at: Date,
  config?: TopicConfig | CritiqueConfig
}


export async function create({ title, author_pid, parent_id, body, type, config }: RegisteringContent) {
  const { id, nick } = await getDataByPublicId(author_pid, ["id", "name"])

  const query = {
    text: `
    WITH
      inserted_content as (
        INSERT INTO
          contents(
            title,
            author_id,
            parent_id,
            body,
            type,
            config
          )
          VALUES ($1, $2, $3, $4, $5, $6)
          RETURNING *
      )
    SELECT
      inserted_content.id,
      inserted_content.title,
      inserted_content.author_id,
      inserted_content.parent_id,
      inserted_content.body,
      inserted_content.status,
      inserted_content.created_at,
    FROM
      inserted_content
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
  return { ...result.rows[0], author: nick }
}