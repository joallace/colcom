import db from "@/database"
import { getDataByPublicId } from "@/models/user"


type InteractionType = "up" | "down" | "favorite" | "bookmark" | "promote"

interface InteractionInsertRequest {
  author_pid: string,
  content_id: string,
  type?: InteractionType
}

interface InteractionAlterRequest {
  interaction_id: number,
  type?: InteractionType
}


async function findAll({ where = "", values = [] as any[] }) {
  const query = {
    text: `
      SELECT
        i.id,
        i.content_id,
        i.type,
        i.created_at,
        i.valid_until,
        users.pid as author_id
      FROM
        interactions i
      INNER JOIN
        users ON users.id = i.author_id
      WHERE ${where}
      ;`,
    values
  }

  const result = await db.query(query)
  return result.rows
}

async function create({ author_pid, content_id, type }: InteractionInsertRequest) {
  const { id } = await getDataByPublicId(author_pid, ["id"])
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
    values: [id, content_id, type]
  }

  const result = await db.query(query)
  return result.rows[0]
}

async function updateById({ interaction_id, type }: InteractionAlterRequest) {
  const query = {
    text: `
      UPDATE
        interactions
      SET
        type = $1
      WHERE
        id = $2
      ;`,
    values: [type, interaction_id]
  }

  const result = await db.query(query)
  console.log(result)
  return result.command === "UPDATE"
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

  const result = await db.query(query)
  console.log(result)
  return result.command === "DELETE"
}

export default Object.freeze({
  findAll,
  create,
  updateById,
  removeById
})

export { InteractionInsertRequest, InteractionAlterRequest }