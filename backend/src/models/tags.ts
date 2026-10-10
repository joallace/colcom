import db from "@/pgDatabase"
import config from "@/config"
import { limitOffset } from "@/pagination"


export interface ResolvedTag {
  id: number,
  slug: string,
  name: string,
  provisional: boolean,
  expired: boolean,
  reserved: boolean
}

export interface Voter {
  id: number,
  created_at: Date
}

// A provisional tag older than TAG_PROVISIONAL_DAYS. The number comes from config.ts, which only
// accepts whole numbers, so it can be written into the SQL.
const expiredSql = (tag: string) =>
  `(${tag}.activated_at IS NULL AND ${tag}.created_at < now() - make_interval(days => ${Number(config.tags.provisionalDays)}))`

// Topics showing every tag in `param` (an INT[] parameter): the one intersection filter, shared by the
// topic lists and, later, search
export const tagFilterSql = (topicId: string, param: string) => `
  ${topicId} IN (
    SELECT
      contents_tags.content_id
    FROM
      contents_tags
    WHERE
      contents_tags.visible
    AND
      contents_tags.tag_id = ANY(${param}::INT[])
    GROUP BY
      contents_tags.content_id
    HAVING
      COUNT(*) = cardinality(${param}::INT[])
  )`

// A topic's tags as a JSON list, the visible ones first and by net endorsements; the viewer's vote on
// each when `userParam` is given. Expired tags are left out.
export const topicTagsSql = (topicId: string, userParam?: string) => `
  COALESCE((
    SELECT
      json_agg(
        json_build_object(
          'slug', tags.slug,
          'name', tags.name,
          'provisional', tags.activated_at IS NULL,
          'reserved', tags.reserved,
          'visible', contents_tags.visible,
          'endorsements', contents_tags.endorsements,
          'contests', contents_tags.contests
          ${userParam ? `,
          'userVote', (
            SELECT
              tag_votes.value
            FROM
              tag_votes
            INNER JOIN
              users AS voter ON voter.id = tag_votes.user_id
            WHERE
              voter.pid = ${userParam}
            AND
              tag_votes.content_id = contents_tags.content_id
            AND
              tag_votes.tag_id = contents_tags.tag_id
          )` : ""}
        )
        ORDER BY
          contents_tags.visible DESC,
          contents_tags.endorsements - contents_tags.contests DESC,
          contents_tags.created_at,
          tags.slug
      )
    FROM
      contents_tags
    INNER JOIN
      tags ON tags.id = contents_tags.tag_id
    WHERE
      contents_tags.content_id = ${topicId}
    AND
      NOT ${expiredSql("tags")}
  ), '[]'::json)`

// The tags with these slugs, by slug, an alias standing for the tag it was merged into
async function resolve(slugs: string[]): Promise<Map<string, ResolvedTag>> {
  const result = await db.query({
    text: `
      SELECT
        requested.slug AS requested,
        target.id,
        target.slug,
        target.name,
        target.activated_at IS NULL AS provisional,
        ${expiredSql("target")} AS expired,
        target.reserved
      FROM
        tags AS requested
      INNER JOIN
        tags AS target ON target.id = COALESCE(requested.alias_of, requested.id)
      WHERE
        requested.slug = ANY($1::TEXT[])
      ;`,
    values: [slugs]
  })

  return new Map(result.rows.map(({ requested, ...tag }) => [requested, tag]))
}

async function voter(pid: string): Promise<Voter> {
  const result = await db.query({ text: "SELECT id, created_at FROM users WHERE pid = $1;", values: [pid] })
  return result.rows[0]
}

async function createdToday(userId: number): Promise<number> {
  const result = await db.query({
    text: "SELECT COUNT(*)::INT AS count FROM tags WHERE author_id = $1 AND created_at > now() - INTERVAL '1 day';",
    values: [userId]
  })
  return result.rows[0].count
}

// Returns the tag's id; when someone else created the same slug meanwhile, theirs
async function create(slug: string, name: string, userId: number): Promise<number> {
  const result = await db.query({
    text: `
      WITH created AS (
        INSERT INTO tags (slug, name, author_id) VALUES ($1, $2, $3)
        ON CONFLICT (slug) DO NOTHING
        RETURNING id
      )
      SELECT id FROM created
      UNION ALL
      SELECT COALESCE(alias_of, id) FROM tags WHERE slug = $1
      LIMIT 1
      ;`,
    values: [slug, name, userId]
  })
  return result.rows[0].id
}

// A reserved tag, active from the start; an existing tag with that slug becomes reserved
async function reserve(slug: string, name: string, userId: number): Promise<number> {
  const result = await db.query({
    text: `
      INSERT INTO tags (slug, name, author_id, reserved, activated_at) VALUES ($1, $2, $3, true, now())
      ON CONFLICT (slug) DO UPDATE SET reserved = true, activated_at = COALESCE(tags.activated_at, now())
      RETURNING id
      ;`,
    values: [slug, name, userId]
  })
  return result.rows[0].id
}

// The tag votes' trigger logs the change and recounts contents_tags
async function vote(topicId: number, tagId: number, userId: number, value: 1 | -1 | 0) {
  if (value === 0)
    await db.query({
      text: "DELETE FROM tag_votes WHERE content_id = $1 AND tag_id = $2 AND user_id = $3;",
      values: [topicId, tagId, userId]
    })
  else
    await db.query({
      text: `
        INSERT INTO tag_votes (content_id, tag_id, user_id, value) VALUES ($1, $2, $3, $4)
        ON CONFLICT (content_id, tag_id, user_id) DO UPDATE SET value = EXCLUDED.value
        ;`,
      values: [topicId, tagId, userId, value]
    })
}

// A provisional tag becomes active, for good, once it shows on enough topics by two or more authors
async function activate(tagId: number) {
  await db.query({
    text: `
      UPDATE
        tags
      SET
        activated_at = now()
      WHERE
        id = $1
      AND
        activated_at IS NULL
      AND
        NOT ${expiredSql("tags")}
      AND (
        SELECT
          COUNT(*) >= $2 AND COUNT(DISTINCT contents.author_id) >= 2
        FROM
          contents_tags
        INNER JOIN
          contents ON contents.id = contents_tags.content_id
        WHERE
          contents_tags.tag_id = $1
        AND
          contents_tags.visible
      )
      ;`,
    values: [tagId, config.tags.activationTopics]
  })
}

// The tags proposed on a topic, visible or not, by id
async function proposed(topicId: number): Promise<Set<number>> {
  const result = await db.query({ text: "SELECT tag_id FROM contents_tags WHERE content_id = $1;", values: [topicId] })
  return new Set(result.rows.map(row => row.tag_id))
}

async function ofTopic(topicId: number, userPid?: string): Promise<any[]> {
  const result = await db.query({
    text: `SELECT ${topicTagsSql("$1::INT", userPid ? "$2::UUID" : undefined)} AS tags;`,
    values: userPid ? [topicId, userPid] : [topicId]
  })
  return result.rows[0].tags
}

// Autocomplete and directory: tags whose slug contains `slug`, those starting with it first, then the
// most used. Aliases, expired and reserved tags (which nobody can apply) are left out.
async function search(slug: string, page: number, pageSize: number) {
  const result = await db.query({
    text: `
      SELECT
        tags.slug,
        tags.name,
        tags.activated_at IS NULL AS provisional,
        COUNT(contents_tags.content_id) FILTER (WHERE contents_tags.visible)::INT AS topics,
        COUNT(*) OVER ()::INT AS total_count
      FROM
        tags
      LEFT JOIN
        contents_tags ON contents_tags.tag_id = tags.id
      WHERE
        tags.alias_of IS NULL
      AND
        NOT tags.reserved
      AND
        NOT ${expiredSql("tags")}
      AND
        strpos(tags.slug, $1) > 0
      GROUP BY
        tags.id
      ORDER BY
        starts_with(tags.slug, $1) DESC,
        topics DESC,
        tags.slug
      ${limitOffset(page, pageSize)}
      ;`,
    values: [slug]
  })

  return {
    tags: result.rows.map(({ total_count, ...tag }) => tag),
    count: result.rows[0]?.total_count ?? 0
  }
}

// How many topics show all of these tags, and which other tags they show most, to narrow them down
async function intersection(tagIds: number[], relatedLimit = 12) {
  const result = await db.query({
    text: `
      WITH matching AS (
        SELECT
          contents_tags.content_id
        FROM
          contents_tags
        WHERE
          contents_tags.visible
        AND
          contents_tags.tag_id = ANY($1::INT[])
        GROUP BY
          contents_tags.content_id
        HAVING
          COUNT(*) = cardinality($1::INT[])
      )
      SELECT
        (SELECT COUNT(*) FROM matching)::INT AS topics,
        COALESCE((
          SELECT
            json_agg(related ORDER BY related.topics DESC, related.slug)
          FROM (
            SELECT
              tags.slug,
              tags.name,
              tags.activated_at IS NULL AS provisional,
              COUNT(*)::INT AS topics
            FROM
              contents_tags
            INNER JOIN
              matching ON matching.content_id = contents_tags.content_id
            INNER JOIN
              tags ON tags.id = contents_tags.tag_id
            WHERE
              contents_tags.visible
            AND
              NOT contents_tags.tag_id = ANY($1::INT[])
            AND
              NOT ${expiredSql("tags")}
            GROUP BY
              tags.id
            ORDER BY
              topics DESC, tags.slug
            LIMIT $2
          ) AS related
        ), '[]'::json) AS related
      ;`,
    values: [tagIds, relatedLimit]
  })
  return result.rows[0]
}

// A topic's tag votes, oldest first. Voters are numbered per topic, as in the poll's history.
async function history(topicId: number) {
  const result = await db.query({
    text: `
      SELECT
        e.id,
        DENSE_RANK() OVER (ORDER BY first.id)::INT AS voter,
        tags.slug AS tag,
        tags.name,
        e.from_value AS "from",
        e.to_value AS "to",
        e.created_at
      FROM
        tag_events e
      INNER JOIN
        tags ON tags.id = e.tag_id
      INNER JOIN LATERAL (
        SELECT MIN(f.id) AS id FROM tag_events f WHERE f.content_id = e.content_id AND f.user_id = e.user_id
      ) first ON true
      WHERE
        e.content_id = $1
      ORDER BY
        e.id
      ;`,
    values: [topicId]
  })
  return result.rows
}

export default Object.freeze({
  resolve,
  voter,
  createdToday,
  create,
  reserve,
  vote,
  activate,
  proposed,
  ofTopic,
  search,
  intersection,
  history
})
