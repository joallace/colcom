import db from "@/database"
import { getDataByPid } from "@/models/user"

type InteractionsTypes = "up" | "down" | "favorite" | "bookmark"

interface RegisteringInteraction {
  user_pid: string,
  content_id: string,
  type: InteractionsTypes
}

export async function create({ user_pid, content_id, type }: RegisteringInteraction) {
  const { id } = await getDataByPid(user_pid, ["id"])
  const query = {
    text: `
      INSERT INTO
        interactions(
          user_id,
          content_id,
          type
        )
      VALUES
        ($1, $2, $3)
      RETURNING
        *
      ;`,
    values: [id, content_id, type],
  }

  const result = await db.query(query)
  return result.rows[0]
}