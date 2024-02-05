import db from "@/database"
import { getDataByPublicId } from "@/models/user"
import { NotFoundError, ValidationError } from "@/errors"


type InteractionType = "up" | "down" | "vote" | "bookmark" | "promote"

interface InteractionInsertRequest {
  author_pid: string,
  content_id: string,
  type?: InteractionType,
  colcoins?: number
}

interface InteractionAlterRequest {
  id: number,
  author_pid: string,
  type?: InteractionType
}

const minimumPromoteValue = 10


function coinsToTime(amount: number) {

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

async function getUserPostInteractions({ author_pid, content_id }: InteractionInsertRequest) {
  const query = {
    text: `
      SELECT
        i.id,
        i.type
      FROM
        interactions i
      INNER JOIN
        users ON users.pid = $1
      WHERE
        i.author_id = users.id
      AND
        i.content_id = $2
      ;`,
    values: [author_pid, content_id]
  }

  const results = await db.query(query)

  return results.rows
}

async function handleChange({ author_pid, content_id, type, colcoins }: InteractionInsertRequest) {
  const postInteractions = await getUserPostInteractions({ author_pid, content_id, type })

  switch (type) {
    case "down":
      for (const interaction of postInteractions) {
        if (interaction.type === "up")
          return [200, await updateById({ id: interaction.id, type, author_pid })]
        if (interaction.type === "down")
          return [204, await removeById(interaction.id)]
      }
      break
    case "up":
      for (const interaction of postInteractions) {
        if (interaction.type === "down")
          return [200, await updateById({ id: interaction.id, type, author_pid })]
        if (interaction.type === "up")
          return [204, await removeById(interaction.id)]
      }
      break
    case "vote":
      // Check if there are votes in other posts of the current topic and then insert
      break
    case "bookmark":
      for (const interaction of postInteractions) {
        if (interaction.type === "bookmark")
          return [204, await removeById(interaction.id)]
      }
      break
    case "promote":
      break
    default:
      throw new ValidationError({
        message: `O tipo de interação "${type}" não é válido.`,
        stack: new Error().stack,
        errorLocationCode: 'MODEL:INTERACTION:HANDLE:INVALID_TYPE'
      })
  }

  return [201, await create({ author_pid, content_id, type, colcoins })]
}



async function create({ author_pid, content_id, type, colcoins }: InteractionInsertRequest) {
  const { id, colcoins: authorAmount } = await getDataByPublicId(author_pid, ["id", "colcoins"])

  if (type === "promote" && (!colcoins || authorAmount < colcoins || colcoins < minimumPromoteValue))
    throw new ValidationError({
      message: "Quantidade de colcoins insuficiente para realizar a ação.",
      action: "Atue na comunidade para ganhar mais colcoins!",
      stack: new Error().stack,
      errorLocationCode: 'MODEL:INTERACTION:CREATE:INSUFFICIENT_BALANCE'
    })

  const query = {
    text: `
      INSERT INTO
        interactions(
          author_id,
          content_id,
          type,
          valid_until
        )
      VALUES
        ($1, $2, $3, $4)
      RETURNING
        *
      ;`,
    values: [id, content_id, type, type === "promote" ? coinsToTime(Number(colcoins)) : null]
  }

  const result = await db.query(query)

  return { ...result.rows[0], author_id: author_pid }
}

async function updateById({ id, author_pid, type }: InteractionAlterRequest) {
  const query = {
    text: `
      UPDATE
        interactions
      SET
        type = $1
      WHERE
        id = $2
      RETURNING
        *
      ;`,
    values: [type, id]
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
  getUserPostInteractions,
  updateById,
  removeById
})

export { InteractionInsertRequest, InteractionAlterRequest }