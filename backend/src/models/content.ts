import db from "@/pgDatabase"
import { NotFoundError, ValidationError } from "@/errors"
import { avatarToBase64, getDataByPublicId } from "@/models/user"
import { limitOffset, orderByColumn } from "@/pagination"


type ContentType = "topic" | "post" | "critique"

const contentOrderBy = {
  id: "contents.id",
  created_at: "contents.created_at",
  upvotes: "upvotes",
  downvotes: "downvotes",
  promotions: "promotions"
}

// Columns of findTree's topic_rows, where the topics are ranked
const topicOrderBy = {
  id: "id",
  created_at: "created_at",
  upvotes: "upvotes",
  downvotes: "downvotes",
  promotions: "promotions"
}

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
  author_id: string,
  parent_id?: number,
  body?: string,
  type: ContentType,
  status: string,
  created_at: Date,
  config?: ConfigType
}

const SUMMARY_LENGTH = 280

// Posts keep only a short summary in the database, the full text lives in git. It's the first
// non empty paragraph (inline markup kept), or the plain text when the post has no paragraphs,
// e.g. when it starts with a table or a chart.
export function summarize(html: unknown): string {
  if (typeof html !== "string")
    return ""

  const paragraph = [...html.matchAll(/<p(?:\s[^>]*)?>([\s\S]*?)<\/p>/g)]
    .map(match => match[1].trim())
    .find(text => text.length > 0)

  const summary = paragraph ?? html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()
  return summary.slice(0, SUMMARY_LENGTH)
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

// paginate = false is only for internal queries already bounded by their WHERE, e.g. a post's critiques
async function findAll({ where = "", orderBy = "id", page = 1, pageSize = 10, values = [] as any[], omitBody = false, includeParentTitle = false, paginate = true }): Promise<Content[]> {
  const query = {
    text: `
      SELECT
        contents.id,
        contents.title,
        contents.parent_id,
        ${includeParentTitle ? "parent.title as parent_title, parent.parent_id as grandparent_id," : ""}
        ${omitBody ? "" : "contents.body,"}
        contents.type,
        contents.status,
        contents.created_at,
        contents.config,
        users.pid as author_id,
        users.name as author,
        users.avatar as author_avatar,
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
                (interaction.config->>'valid_until')::TIMESTAMP WITH TIME ZONE > NOW()
            )
            ELSE NULL
          END
        )::INT as promotions
      FROM
        contents
      INNER JOIN
        users ON contents.author_id = users.id
      ${includeParentTitle ?
        `LEFT JOIN
          contents as parent ON contents.parent_id = parent.id`
        :
        ""
      }
      ${where ? `WHERE ${where}` : ""}
      ORDER BY ${orderByColumn(orderBy, contentOrderBy)} DESC, contents.id DESC
      ${paginate ? limitOffset(page, pageSize) : ""}
      ;`,
    values
  }

  const result = await db.query(query)
  avatarToBase64("author_avatar", result)
  return result.rows
}

// pg's base64 breaks lines every 76 characters, which a data URL can't contain
const AVATAR_BASE64 = "translate(encode(users.avatar, 'base64'), E'\\n', '')"

interface TreeOptions {
  where?: string,
  orderBy?: string,
  page?: number,
  pageSize?: number,
  values?: any[],
  // How many of each topic's posts to return, the most voted first; all of them when omitted.
  // childrenStats always covers every post.
  childLimit?: number,
  // The user whose interactions with each topic and poll vote are included
  userPid?: string
}

// A page of topics, each with its posts ranked by poll votes, stats over all its posts and, for a
// logged in user, their interactions with it and the post they voted for. A single query: Postgres
// ranks, crops and aggregates the posts, instead of every post being fetched to be cropped here.
async function findTree({ where = "topics.type = 'topic'", orderBy = "promotions", page = 1, pageSize = 10, values = [], childLimit, userPid }: TreeOptions): Promise<any[]> {
  const userParam = `$${values.length + 1}::UUID`
  const childLimitParam = `$${values.length + 2}::INT`

  const query = {
    text: `
      WITH topic_rows AS (
        SELECT
          topics.id,
          topics.title,
          topics.parent_id,
          topics.type,
          topics.body,
          topics.status,
          topics.created_at,
          topics.config,
          users.pid AS author_id,
          users.name AS author,
          ${AVATAR_BASE64} AS author_avatar,
          (
            SELECT COUNT(*) FROM interactions
            WHERE interactions.content_id = topics.id AND interactions.type = 'up'
          )::INT AS upvotes,
          (
            SELECT COUNT(*) FROM interactions
            WHERE interactions.content_id = topics.id AND interactions.type = 'down'
          )::INT AS downvotes,
          (
            SELECT COUNT(*) FROM interactions
            WHERE
              interactions.content_id = topics.id
            AND
              interactions.type = 'promote'
            AND
              (interactions.config->>'valid_until')::TIMESTAMP WITH TIME ZONE > NOW()
          )::INT AS promotions
        FROM
          contents AS topics
        INNER JOIN
          users ON topics.author_id = users.id
        WHERE ${where}
      ),
      page_topics AS (
        SELECT
          *,
          ROW_NUMBER() OVER (ORDER BY ${orderByColumn(orderBy, topicOrderBy)} DESC, id DESC) AS position
        FROM
          topic_rows
        ORDER BY
          position
        ${limitOffset(page, pageSize)}
      ),
      -- Only the posts of this page's topics, their votes counted in one pass over interactions
      ranked_posts AS (
        SELECT
          posts.id,
          posts.title,
          posts.parent_id,
          posts.type,
          posts.body,
          posts.status,
          posts.created_at,
          posts.config,
          users.pid AS author_id,
          users.name AS author,
          ${AVATAR_BASE64} AS author_avatar,
          COUNT(interactions.id) FILTER (WHERE interactions.type = 'up')::INT AS upvotes,
          COUNT(interactions.id) FILTER (WHERE interactions.type = 'down')::INT AS downvotes,
          COUNT(interactions.id) FILTER (WHERE interactions.type = 'vote')::INT AS votes,
          ROW_NUMBER() OVER (
            PARTITION BY posts.parent_id
            ORDER BY
              COUNT(interactions.id) FILTER (WHERE interactions.type = 'vote') DESC,
              COUNT(interactions.id) FILTER (WHERE interactions.type = 'up') DESC,
              posts.id
          ) AS rank
        FROM
          contents AS posts
        INNER JOIN
          page_topics ON posts.parent_id = page_topics.id
        INNER JOIN
          users ON posts.author_id = users.id
        LEFT JOIN
          interactions ON interactions.content_id = posts.id
        WHERE
          posts.type = 'post'
        GROUP BY
          posts.id, users.id
      )
      SELECT
        page_topics.id,
        page_topics.title,
        page_topics.parent_id,
        page_topics.type,
        page_topics.body,
        page_topics.status,
        page_topics.created_at,
        page_topics.config,
        page_topics.author_id,
        page_topics.author,
        page_topics.author_avatar,
        page_topics.upvotes,
        page_topics.downvotes,
        page_topics.promotions,
        children.list AS children,
        stats.summary AS "childrenStats",
        CASE WHEN ${userParam} IS NULL THEN NULL ELSE ARRAY(
          SELECT
            interactions.type
          FROM
            interactions
          INNER JOIN
            users ON users.id = interactions.author_id
          WHERE
            users.pid = ${userParam}
          AND
            interactions.content_id = page_topics.id
          AND (
            interactions.config IS NULL
            OR
            interactions.config->>'valid_until' IS NULL
            OR
            (interactions.config->>'valid_until')::TIMESTAMP WITH TIME ZONE > NOW()
          )
        ) END AS "userInteractions",
        (
          SELECT
            interactions.content_id
          FROM
            interactions
          INNER JOIN
            users ON users.id = interactions.author_id
          INNER JOIN
            contents AS voted ON voted.id = interactions.content_id
          WHERE
            interactions.type = 'vote'
          AND
            users.pid = ${userParam}
          AND
            voted.parent_id = page_topics.id
          LIMIT 1
        ) AS "userVote"
      FROM
        page_topics
      LEFT JOIN LATERAL (
        SELECT
          COALESCE(json_agg(to_jsonb(ranked_posts) - 'rank' ORDER BY ranked_posts.rank), '[]'::json) AS list
        FROM
          ranked_posts
        WHERE
          ranked_posts.parent_id = page_topics.id
        AND
          (${childLimitParam} IS NULL OR ranked_posts.rank <= ${childLimitParam})
      ) AS children ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          json_build_object(
            'count', COUNT(*),
            'upvotes', COALESCE(SUM(ranked_posts.upvotes), 0),
            'downvotes', COALESCE(SUM(ranked_posts.downvotes), 0),
            'votes', COALESCE(SUM(ranked_posts.votes), 0)
          ) AS summary
        FROM
          ranked_posts
        WHERE
          ranked_posts.parent_id = page_topics.id
      ) AS stats ON TRUE
      ORDER BY
        page_topics.position
    ;`,
    values: [...values, userPid ?? null, childLimit ?? null]
  }

  const results = await db.query(query)
  return results.rows
}

async function findById(id: number, options = {}): Promise<Content> {
  const result = await findAll({ where: "contents.id = $1", values: [id], pageSize: 1, ...options })
  return result[0]
}

async function updateById(id: number, body: string, author_pid: string) {
  const query = {
    text: `
      UPDATE
        contents
      SET
        body = $1
      WHERE
        id = $2
      RETURNING
        *
      ;`,
    values: [summarize(body), id]
  }

  const result = await db.query(query)
  return { ...result.rows[0], author_id: author_pid }
}

// Only used to roll back a freshly created content whose git write failed, so nothing references it yet
async function removeById(id: number) {
  const query = {
    text: `
      DELETE FROM
        contents
      WHERE
        id = $1
      ;`,
    values: [id],
  }

  await db.query(query)
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

// Counts the contents matching a findAll `where`, which may filter on the author (users.*)
async function count({ where = "", values = [] as any[] }): Promise<number> {
  const query = {
    text: `
      SELECT
        COUNT(*)::int
      FROM
        contents
      INNER JOIN
        users ON contents.author_id = users.id
      ${where ? `WHERE ${where}` : ""}
      ;`,
    values
  }

  const result = await db.query(query)
  return result.rows[0].count
}

export async function getCount(type: ContentType): Promise<any> {
  const query = {
    text: `
      SELECT
        COUNT(*)::int
      FROM
        contents
      WHERE
        contents.type = $1
      ;`,
    values: [type],
  }

  const result = await db.query(query)

  return result.rows[0].count
}

export default Object.freeze({
  create,
  findAll,
  findTree,
  findById,
  updateById,
  removeById,
  getDataById,
  getCount,
  count
})

export { Content as IContent, ContentInsertRequest, ContentType }
