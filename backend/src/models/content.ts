import db from "@/database"
import { NotFoundError, ValidationError } from "@/errors"
import { getDataByPublicId } from "@/models/user"
import { QueryResult } from "pg"


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

async function validateUnique(value: string, field: keyof Content) {
  const query = {
    text: `SELECT ${field} FROM contents WHERE LOWER(${field}) = LOWER($1)`,
    values: [value],
  }

  const results = await db.query(query)

  if (Number(results.rowCount) > 0) {
    throw new ValidationError({
      message: `O "${field}" informado já está sendo usado.`,
      stack: new Error().stack,
      errorLocationCode: 'MODEL:USER:VALIDATE_UNIQUE:ALREADY_EXISTS',
      key: field,
    })
  }
}

async function create({ title, author_pid, parent_id, body, type, config }: ContentInsertRequest): Promise<Content> {
  if (!/^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/.test(author_pid))
    throw new ValidationError({
      message: 'O campo "author_pid" não é um uuid válido.'
    })

  await validateUnique(title, "title")

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

async function findAll({ where = "", orderBy = "id", page = 1, pageSize = 10, values = [] as any[] }): Promise<Content[]> {
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
        )::INT as upvotes,
        (
          SELECT COUNT(*) FROM
            interactions as interaction
          WHERE
            interaction.content_id = contents.id
          AND
            interaction.type = 'down'
        )::INT as downvotes,
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
        )::INT as promotions
      FROM
        contents
      INNER JOIN
        users ON contents.author_id = users.id
      WHERE ${where}
      ORDER BY ${orderBy} DESC
      LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      ;`,
    values
  }

  const result = await db.query(query)
  return result.rows
}

const rowsToTree = (rows: Array<any>) => {
  const tree: any = {}

  for (const row of rows) {
    if (row.parent_id === null)
      tree[row.id] = { ...row, children: tree[row.id]?.children || [] }
    else {
      if (tree[row.parent_id])
        tree[row.parent_id].children.push({ ...row })
      else
        tree[row.parent_id] = { children: [{ ...row }] }
    }
  }

  return Object.values(tree).reverse()
}


async function findTree({ where = "topics.type = 'topic'", orderBy = "id", page = 1, pageSize = 10, values = [] as any[] }): Promise<any[]> {
  const query = {
    text: `
      WITH RECURSIVE content_tree AS (
        (
          SELECT
            topics.id,
            topics.title,
            topics.parent_id,
            topics.type,
            topics.status,
            topics.created_at,
            topics.config,
            users.pid as author_id,
            users.name as author,
            (
              SELECT COUNT(*) FROM
                interactions as interaction
              WHERE
                interaction.content_id = topics.id
              AND
                interaction.type = 'up'
            )::INT as upvotes,
            (
              SELECT COUNT(*) FROM
                interactions as interaction
              WHERE
                interaction.content_id = topics.id
              AND
                interaction.type = 'down'
            )::INT as downvotes,
            (
              SELECT
                COUNT(*)
              FROM
                interactions as interaction
              WHERE
                interaction.content_id = topics.id
              AND
                interaction.type = 'promote'
              AND
                interaction.valid_until > NOW()
            )::INT as promotions
          FROM
            contents as topics
          INNER JOIN
            users ON topics.author_id = users.id
          WHERE ${where}
          ORDER BY promotions DESC
          LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
        )
    
        UNION ALL
    
        (
          SELECT
            posts.id,
            posts.title,
            posts.parent_id,
            posts.type,
            posts.status,
            posts.created_at,
            posts.config,
            users.pid as author_id,
            users.name as author,
            (
              SELECT COUNT(*) FROM
                interactions as interaction
              WHERE
                interaction.content_id = posts.id
              AND
                interaction.type = 'up'
            )::INT as upvotes,
            (
              SELECT COUNT(*) FROM
                interactions as interaction
              WHERE
                interaction.content_id = posts.id
              AND
                interaction.type = 'down'
            )::INT as downvotes,
            NULL as promotions
          FROM
            contents as posts
          INNER JOIN
            content_tree ON posts.parent_id = content_tree.id
          INNER JOIN
            users ON posts.author_id = users.id
          WHERE
            posts.type = 'post'
          ORDER BY upvotes DESC
          ${pageSize !== 1 ? "LIMIT 3" : ""}
        )
      )
      SELECT
        *
      FROM
        content_tree
    ;`,
    values
  }

  const result = await db.query(query)
  return rowsToTree(result.rows)
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
  findTree,
  findById,
  getTopicNumberOfVotes,
  getDataById
})

export { Content as IContent, ContentInsertRequest, ContentType }