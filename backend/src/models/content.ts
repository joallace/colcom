import db from "@/database"
import { getDataByPid } from "@/models/user"

interface RegisteringContent {
  title: string,
  author_pid: string,
  parent_id: string | null,
  body: string | null,
}

export async function create({ title, author_pid, parent_id, body }: RegisteringContent) {
  const { id, nick } = await getDataByPid(author_pid, ["id", "nick"])

  const query = {
    text: `
    WITH
      inserted_content as (
        INSERT INTO
          contents(
            title,
            author_id,
            parent_id,
            body
          )
          VALUES ($1, $2, $3, $4)
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
      users.nick as author
    FROM
      inserted_content
    ;`,
    values: [
      title,
      id,
      parent_id,
      body
    ],
  }
  
  const result = await db.query(query)
  return { ...result.rows[0], author: nick }
}