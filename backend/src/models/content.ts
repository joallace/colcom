import { CritiqueConfig, PostConfig, TopicConfig } from "@colcom/shared"

import db from "@/pgDatabase"
import { NotFoundError, ValidationError } from "@/errors"
import { avatarToBase64, getDataByPublicId } from "@/models/user"
import { limitOffset, orderByColumn } from "@/pagination"
import { tagFilterSql, topicTagsSql } from "@/models/tags"
import { QueryParams, interactionCountSql, promotionCountSql, queryParams, userInteractionsSql } from "@/models/sql"
import type { InteractionType } from "@/models/interactions"


type ContentType = "topic" | "post" | "critique"

// Output columns of findAll's select and of findTree's topic_rows. ORDER BY reads a bare name as the
// output column, so `id` and `created_at` aren't ambiguous next to the joined tables'.
const orderColumns = {
  id: "id",
  created_at: "created_at",
  upvotes: "upvotes",
  downvotes: "downvotes",
  promotions: "promotions"
}

// A content's config, by its type
type Typed =
  | { type: "topic", parent_id: null, config: TopicConfig }
  | { type: "post", parent_id: number, config: PostConfig }
  | { type: "critique", parent_id: number, config: CritiqueConfig }

type Content = Typed & {
  id: number,
  title: string,
  // The author's name and public id (users.pid), never the internal id
  author: string,
  author_id: string,
  body?: string,
  status: string,
  created_at: Date
}

// The columns of a row of `contents`, where the author is the internal users.id
type ContentRow = Typed & {
  id: number,
  title: string,
  author_id: number,
  body: string | null,
  status: string,
  created_at: Date
}

// A content as findAll lists it
type ListedContent = Content & {
  author_avatar: string,
  upvotes: number,
  downvotes: number,
  // Topics only
  promotions: number | null,
  userInteractions?: InteractionType[],
  total_count?: number,
  parent_title?: string,
  grandparent_id?: number | null
}

// A topic as findTree returns it; its children and stats are JSON built by the query
type TopicTree = Extract<ListedContent, { type: "topic" }> & {
  children: unknown[],
  childrenStats: Record<string, unknown>,
  tags: unknown[],
  userInteractions: InteractionType[] | null,
  userVote: number | null
}

type ContentInsertRequest = {
  title: string,
  author_pid: string,
  body?: string
} & (
  | { type: "topic", parent_id?: undefined, config: TopicConfig }
  | { type: "post", parent_id: number, config: PostConfig }
  | { type: "critique", parent_id: number, config: CritiqueConfig }
)

// Pick over each member of a union, keeping what ties a content's type to its config
type PickEach<T, K extends PropertyKey> = T extends unknown ? Pick<T, K & keyof T> : never

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

const ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " " }

// What search indexes of a body: its text without markup, tags turned into spaces so words in
// neighbouring blocks don't run together. Entities other than these are decoded by their number.
// U+E000 and U+E001 are dropped: search excerpts use them to mark the matched words.
export function plainText(html: unknown): string {
  if (typeof html !== "string")
    return ""

  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (entity, name: string) => {
      if (name[0] !== "#")
        return ENTITIES[name.toLowerCase()] ?? entity
      const code = /^#x/i.test(name) ? parseInt(name.slice(2), 16) : Number(name.slice(1))
      return code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : entity
    })
    .replace(/[]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

// Titles are unique across every content, ignoring case
async function validateUniqueTitle(title: string) {
  const results = await db.query({
    text: "SELECT 1 FROM contents WHERE LOWER(title) = LOWER($1)",
    values: [title],
  })

  if (Number(results.rowCount) > 0) {
    throw new ValidationError({
      message: 'O "title" informado já está sendo usado.',
      errorLocationCode: 'MODEL:CONTENT:VALIDATE_UNIQUE:ALREADY_EXISTS',
      key: "title",
    })
  }
}

// `body` is the whole text: a post keeps only its summary, and search its plain text. A post also
// starts with its topic's tag names, which the tag_votes trigger keeps from then on.
async function create({ title, author_pid, parent_id, body, type, config }: ContentInsertRequest): Promise<Content> {
  // author_pid comes from a verified session (authHandler checks it against users) or the system account
  await validateUniqueTitle(title)

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
          config,
          search_text,
          tag_names
        )
      VALUES
          ($1, $2, $3, $4, $5, $6, $7, CASE WHEN $5 = 'post' THEN topic_tag_names($3) END)
      RETURNING
        ${RETURNED_COLUMNS}
    ;`,
    values: [
      title,
      id,
      parent_id,
      type === "post" ? summarize(body) : body,
      type,
      config,
      plainText(body)
    ],
  }

  const result = await db.query(query)
  return { ...result.rows[0], author: name, author_id: author_pid }
}

// A row as the API sends it, without the columns kept for search
const RETURNED_COLUMNS = "id, title, author_id, parent_id, body, type, status, config, created_at"

// Builds a query's WHERE: it adds the values it uses to the query's parameters and returns the condition
type Filter = (params: QueryParams) => string

interface FindAllOptions {
  orderBy?: string,
  page?: number,
  pageSize?: number,
  omitBody?: boolean,
  includeParentTitle?: boolean,
  // false only for queries already bounded by their filter, e.g. a post's critiques
  paginate?: boolean,
  // The user whose interactions with each content are included (userInteractions)
  userPid?: string,
  // Adds total_count, how many contents match the filter across all pages, so lists need no count query
  withTotal?: boolean
}

// Contents matching `filter`, which may also filter on the author (users.*)
async function findAll(filter: Filter | undefined, { orderBy = "id", page = 1, pageSize = 10, omitBody = false, includeParentTitle = false, paginate = true, userPid, withTotal = false }: FindAllOptions = {}): Promise<ListedContent[]> {
  const params = queryParams()
  const where = filter?.(params)

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
        ${interactionCountSql("contents.id", "up")} as upvotes,
        ${interactionCountSql("contents.id", "down")} as downvotes,
        CASE WHEN contents.type = 'topic' THEN ${promotionCountSql("contents.id")} END as promotions
        ${userPid ? `, ${userInteractionsSql("contents.id", params.add(userPid, "UUID"))} AS "userInteractions"` : ""}
        ${withTotal ? ", COUNT(*) OVER ()::INT AS total_count" : ""}
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
      ORDER BY ${orderByColumn(orderBy, orderColumns)} DESC, contents.id DESC
      ${paginate ? limitOffset(page, pageSize) : ""}
      ;`,
    values: params.values
  }

  const result = await db.query(query)
  avatarToBase64("author_avatar", result)
  return result.rows
}

// Counts the contents matching a findAll filter
async function countAll(filter: Filter | undefined): Promise<number> {
  const params = queryParams()
  const where = filter?.(params)

  const result = await db.query({
    text: `
      SELECT
        COUNT(*)::int
      FROM
        contents
      INNER JOIN
        users ON contents.author_id = users.id
      ${where ? `WHERE ${where}` : ""}
      ;`,
    values: params.values
  })
  return result.rows[0].count
}

const byAuthor = (authorPid?: string): Filter | undefined =>
  authorPid ? params => `users.pid = ${params.add(authorPid, "UUID")}` : undefined

interface PageOptions {
  page?: number,
  pageSize?: number
}

// A page of every content, or of one author's (the profile), each with its parent's title and total_count
async function findList({ authorPid, ...options }: PageOptions & { authorPid?: string, orderBy?: string, userPid?: string }): Promise<ListedContent[]> {
  return await findAll(byAuthor(authorPid), { ...options, includeParentTitle: true, withTotal: true })
}

async function countList({ authorPid }: { authorPid?: string } = {}): Promise<number> {
  return await countAll(byAuthor(authorPid))
}

const bookmarkedBy = (userPid: string): Filter => params => `
  contents.id IN (
    SELECT
      interactions.content_id
    FROM
      interactions
    INNER JOIN
      users AS bookmarker ON bookmarker.id = interactions.author_id
    WHERE
      interactions.type = 'bookmark'
    AND
      bookmarker.pid = ${params.add(userPid, "UUID")}
  )`

// A page of the contents a user bookmarked, with the user's interactions, parent titles and total_count
async function findBookmarked(userPid: string, options: PageOptions = {}): Promise<ListedContent[]> {
  return await findAll(bookmarkedBy(userPid), { ...options, includeParentTitle: true, userPid, withTotal: true })
}

async function countBookmarked(userPid: string): Promise<number> {
  return await countAll(bookmarkedBy(userPid))
}

// The contents with these ids, in no particular order, as findList shows them (search results)
async function findListByIds(ids: number[], userPid?: string): Promise<ListedContent[]> {
  return await findAll(params => `contents.id = ANY(${params.add(ids, "INT[]")})`, { includeParentTitle: true, paginate: false, userPid })
}

// Every critique of a post, oldest first, with the viewer's interactions
async function critiquesOf(postId: number, userPid?: string): Promise<Extract<ListedContent, { type: "critique" }>[]> {
  const critiques = <Extract<ListedContent, { type: "critique" }>[]>await findAll(
    params => `contents.parent_id = ${params.add(postId, "INT")} AND contents.type = 'critique'`,
    { paginate: false, userPid }
  )
  return critiques.reverse()
}

// pg's base64 breaks lines every 76 characters, which a data URL can't contain
export const AVATAR_BASE64 = "translate(encode(users.avatar, 'base64'), E'\\n', '')"

interface TreeOptions extends PageOptions {
  orderBy?: string,
  // How many of each topic's posts to return, the most voted first; all of them when omitted.
  // childrenStats always covers every post.
  childLimit?: number,
  // The user whose interactions with each topic and poll vote are included
  userPid?: string
}

// A page of the topics matching `filter`, each with its posts ranked by poll votes, stats over all its
// posts, its tags and, for a logged in user, their interactions with it, the post they voted for and
// their tag votes. A single query: Postgres ranks, crops and aggregates the posts, instead of every
// post being fetched to be cropped here.
async function findTree(filter: Filter, { orderBy = "promotions", page = 1, pageSize = 10, childLimit, userPid }: TreeOptions): Promise<TopicTree[]> {
  const params = queryParams()
  const where = filter(params)
  const userParam = params.add(userPid ?? null, "UUID")
  const childLimitParam = params.add(childLimit ?? null, "INT")

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
          ${interactionCountSql("topics.id", "up")} AS upvotes,
          ${interactionCountSql("topics.id", "down")} AS downvotes,
          ${promotionCountSql("topics.id")} AS promotions
        FROM
          contents AS topics
        INNER JOIN
          users ON topics.author_id = users.id
        WHERE
          topics.type = 'topic'
        AND
          ${where}
      ),
      page_topics AS (
        SELECT
          *,
          ROW_NUMBER() OVER (ORDER BY ${orderByColumn(orderBy, orderColumns)} DESC, id DESC) AS position
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
          COUNT(interactions.id) FILTER (WHERE interactions.type = 'suggestion')::INT AS suggestions,
          (
            SELECT COUNT(*) FROM contents AS critiques
            WHERE critiques.parent_id = posts.id AND critiques.type = 'critique'
          )::INT AS critiques,
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
        ${topicTagsSql("page_topics.id", userParam)} AS tags,
        CASE WHEN ${userParam} IS NULL THEN NULL ELSE ${userInteractionsSql("page_topics.id", userParam)} END AS "userInteractions",
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
            'votes', COALESCE(SUM(ranked_posts.votes), 0),
            'suggestions', COALESCE(SUM(ranked_posts.suggestions), 0),
            'critiques', COALESCE(SUM(ranked_posts.critiques), 0),
            'answers', (
              -- Over all posts, not only the cropped children, so the list's grouped view
              -- shows each answer's real share of the poll
              SELECT
                COALESCE(json_object_agg(by_answer.answer, json_build_object('count', by_answer.count, 'votes', by_answer.votes)), '{}'::json)
              FROM (
                SELECT
                  answered.config->>'answer' AS answer,
                  COUNT(*) AS count,
                  SUM(answered.votes) AS votes
                FROM
                  ranked_posts AS answered
                WHERE
                  answered.parent_id = page_topics.id
                AND
                  answered.config->>'answer' IS NOT NULL
                GROUP BY
                  answered.config->>'answer'
              ) AS by_answer
            )
          ) AS summary
        FROM
          ranked_posts
        WHERE
          ranked_posts.parent_id = page_topics.id
      ) AS stats ON TRUE
      ORDER BY
        page_topics.position
    ;`,
    values: params.values
  }

  const results = await db.query(query)
  return results.rows
}

type TopicListOptions = Omit<TreeOptions, keyof PageOptions | "orderBy">

const tagged = (tagIds?: number[]): Filter =>
  params => tagIds ? tagFilterSql("topics.id", params.add(tagIds)) : "TRUE"

// The topic list, optionally only the topics showing all of `tagIds`
async function findTopics({ tagIds, ...options }: TreeOptions & { tagIds?: number[] }): Promise<TopicTree[]> {
  return await findTree(tagged(tagIds), options)
}

async function countTopics({ tagIds }: { tagIds?: number[] } = {}): Promise<number> {
  const params = queryParams()
  const where = tagged(tagIds)(params)

  const result = await db.query({
    text: `SELECT COUNT(*)::int FROM contents AS topics WHERE topics.type = 'topic' AND ${where};`,
    values: params.values
  })
  return result.rows[0].count
}

// One topic with all its posts
async function findTopic(id: number, userPid?: string): Promise<TopicTree | undefined> {
  const [topic] = await findTree(params => `topics.id = ${params.add(id, "INT")}`, { pageSize: 1, userPid })
  return topic
}

// The topics with these ids, in no particular order
async function findTopicsByIds(ids: number[], options: TopicListOptions = {}): Promise<TopicTree[]> {
  return await findTree(params => `topics.id = ANY(${params.add(ids, "INT[]")})`, { ...options, pageSize: ids.length })
}

// An author's topics with these titles, in no particular order
async function findTopicsByTitle(authorId: number, titles: string[], options: TopicListOptions = {}): Promise<TopicTree[]> {
  return await findTree(
    params => `topics.author_id = ${params.add(authorId, "INT")} AND topics.title = ANY(${params.add(titles, "TEXT[]")})`,
    { ...options, pageSize: titles.length }
  )
}

async function findById(id: number, options: { omitBody?: boolean, includeParentTitle?: boolean } = {}): Promise<ListedContent | undefined> {
  const [content] = await findAll(params => `contents.id = ${params.add(id, "INT")}`, { ...options, pageSize: 1 })
  return content
}

// How many poll votes, suggestions (pending or answered) and critiques a post has received, and how many
// votes its topic's poll has in all: its share of the poll is a metric of its own, and the rest, with its
// up and down votes, is what its "interactions" metric adds up
async function interactionCounts(id: number): Promise<{ votes: number, topicVotes: number, suggestions: number, critiques: number }> {
  const result = await db.query({
    text: `
      SELECT
        COUNT(*) FILTER (WHERE interactions.type = 'vote')::INT AS votes,
        (
          SELECT COUNT(*) FROM interactions AS topic_votes
          INNER JOIN contents AS siblings ON siblings.id = topic_votes.content_id
          WHERE siblings.parent_id = (SELECT parent_id FROM contents WHERE id = $1) AND topic_votes.type = 'vote'
        )::INT AS "topicVotes",
        COUNT(*) FILTER (WHERE interactions.type = 'suggestion')::INT AS suggestions,
        (
          SELECT COUNT(*) FROM contents
          WHERE contents.parent_id = $1 AND contents.type = 'critique'
        )::INT AS critiques
      FROM
        interactions
      WHERE
        interactions.content_id = $1
    ;`,
    values: [id]
  })
  return result.rows[0]
}

// A post's new version: its summary and the text search indexes
async function updateById(id: number, body: string, author_pid: string) {
  const query = {
    text: `
      UPDATE
        contents
      SET
        body = $1,
        search_text = $3
      WHERE
        id = $2
      RETURNING
        ${RETURNED_COLUMNS}
      ;`,
    values: [summarize(body), id, plainText(body)]
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

// Some columns of a content, or a 404 when it doesn't exist (findById returns undefined instead)
export async function getFieldsOrThrow<K extends keyof ContentRow>(id: number, data: K[]): Promise<PickEach<ContentRow, K>> {
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
      message: `O conteúdo com "id" de valor "${id}" não foi encontrado no sistema.`,
      action: 'Verifique se o "id" do conteúdo está digitado corretamente.'
    })
  }
  return result.rows[0]
}

export default Object.freeze({
  create,
  findById,
  findList,
  findListByIds,
  countList,
  findBookmarked,
  countBookmarked,
  critiquesOf,
  findTopics,
  countTopics,
  findTopic,
  findTopicsByIds,
  findTopicsByTitle,
  interactionCounts,
  updateById,
  removeById,
  getFieldsOrThrow
})

export { Content as IContent, ContentInsertRequest, ContentType, ListedContent, TopicTree }
