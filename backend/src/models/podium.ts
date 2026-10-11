import { PostConfig } from "@colcom/shared"

import db from "@/pgDatabase"
import { avatarToBase64 } from "@/models/user"
import { queryParams } from "@/models/sql"


export type PodiumType = "topic" | "post"

// Ties share a position (RANK), so two can stand on the same step
interface PodiumUser {
  position: number,
  pid: string,
  name: string,
  avatar: string,
  prestige: number
}

interface PodiumContent {
  position: number,
  // upvotes − downvotes, of the votes counted (see topContents)
  score: number,
  upvotes: number,
  downvotes: number,
  id: number,
  title: string,
  // The author's name and public id (users.pid), never the internal id
  author: string,
  author_id: string,
  author_avatar: string,
  created_at: Date,
  // Posts only: the answer they defend and the topic they answer
  config?: PostConfig,
  topic?: { id: number, title: string }
}

// The users with the most prestige, the oldest account first among equals. Nobody without any is
// ranked, nor `excludedId` (the system account, which doesn't take part).
async function topUsers(size: number, excludedId?: number): Promise<PodiumUser[]> {
  const params = queryParams()
  const excluded = excludedId === undefined ? "" : `AND id <> ${params.add(excludedId, "INT")}`

  const result = await db.query({
    text: `
      SELECT
        RANK() OVER (ORDER BY prestige DESC)::INT AS position,
        pid,
        name,
        avatar,
        prestige
      FROM
        users
      WHERE
        prestige > 0
      ${excluded}
      ORDER BY
        prestige DESC, id
      LIMIT ${params.add(size, "INT")}
      ;`,
    values: params.values
  })

  avatarToBase64("avatar", result)
  return result.rows
}

// The topics or posts whose up votes most outnumber their down votes. Only the votes cast in the
// last `days` days count (all of them when null), and never the author's own, which would be a free
// point. Only a positive balance is ranked; among equal ones, the oldest content comes first.
async function topContents({ type, days, size }: { type: PodiumType, days: number | null, size: number }): Promise<PodiumContent[]> {
  const params = queryParams()
  const contentType = params.add(type, "TEXT")
  const since = days === null ? "" : `AND vote.created_at > NOW() - make_interval(days => ${params.add(days, "INT")})`

  const result = await db.query({
    text: `
      WITH balance AS (
        SELECT
          vote.content_id,
          COUNT(*) FILTER (WHERE vote.type = 'up')::INT AS upvotes,
          COUNT(*) FILTER (WHERE vote.type = 'down')::INT AS downvotes
        FROM
          interactions AS vote
        INNER JOIN
          contents ON contents.id = vote.content_id
        WHERE
          vote.type IN ('up', 'down')
        AND
          contents.type = ${contentType}
        AND
          vote.author_id <> contents.author_id
        ${since}
        GROUP BY
          vote.content_id
      ),
      ranked AS (
        SELECT
          content_id,
          upvotes,
          downvotes,
          upvotes - downvotes AS score,
          RANK() OVER (ORDER BY upvotes - downvotes DESC)::INT AS position
        FROM
          balance
        WHERE
          upvotes > downvotes
        ORDER BY
          score DESC, content_id
        LIMIT ${params.add(size, "INT")}
      )
      SELECT
        ranked.position,
        ranked.score,
        ranked.upvotes,
        ranked.downvotes,
        contents.id,
        contents.title,
        contents.config,
        contents.created_at,
        users.pid AS author_id,
        users.name AS author,
        users.avatar AS author_avatar,
        topic.id AS topic_id,
        topic.title AS topic_title
      FROM
        ranked
      INNER JOIN
        contents ON contents.id = ranked.content_id
      INNER JOIN
        users ON users.id = contents.author_id
      LEFT JOIN
        contents AS topic ON topic.id = contents.parent_id
      ORDER BY
        ranked.score DESC, ranked.content_id
      ;`,
    values: params.values
  })

  avatarToBase64("author_avatar", result)
  return result.rows.map(({ topic_id, topic_title, config, ...content }) =>
    type === "post" ? { ...content, config, topic: { id: topic_id, title: topic_title } } : content
  )
}

export default Object.freeze({
  topUsers,
  topContents
})
