import db from "@/database"
import { getDataByPublicId } from "@/models/user"


type InteractionType = "up" | "down" | "favorite" | "bookmark" | "promote"

interface RegisteringInteraction {
  user_pid: string,
  content_id: string,
  type: InteractionType
}


export async function create({ user_pid, content_id, type }: RegisteringInteraction) {
  const { id } = await getDataByPublicId(user_pid, ["id"])
  const query = {
    text: `
      INSERT INTO
        interactions(
          author_id,
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