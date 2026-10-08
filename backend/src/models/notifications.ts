import db from "@/pgDatabase"
import logger from "@/logger"
import { AVATAR_BASE64 } from "@/models/content"
import { limitOffset } from "@/pagination"


// What happened, from the recipient's point of view:
// - critique: someone criticised their post (content: the post, subject: the critique)
// - suggestion: someone suggested an edit to their post (content: the post, interaction: the suggestion)
// - suggestion_accepted, suggestion_rejected: the post's author answered their suggestion (same)
// - post: someone answered their topic (content: the topic, subject: the post)
// - clone: someone made a new post from a version of theirs (content: their post, subject: the clone)
export type NotificationType = "critique" | "suggestion" | "suggestion_accepted" | "suggestion_rejected" | "post" | "clone"

export interface NotifyRequest {
  type: NotificationType,
  actor_pid: string,
  content_id: number,
  subject_id?: number,
  interaction_id?: number
}

// Who is told: the author of what the notification is about, except for an answer to a suggestion,
// which goes to whoever suggested it. Each query selects `author_id`.
const recipientOf: Record<NotificationType, string> = {
  critique: "SELECT author_id FROM contents WHERE id = $3",
  suggestion: "SELECT author_id FROM contents WHERE id = $3",
  suggestion_accepted: "SELECT author_id FROM interactions WHERE id = $5",
  suggestion_rejected: "SELECT author_id FROM interactions WHERE id = $5",
  post: "SELECT author_id FROM contents WHERE id = $3",
  clone: "SELECT author_id FROM contents WHERE id = $3"
}

async function create({ type, actor_pid, content_id, subject_id, interaction_id }: NotifyRequest): Promise<void> {
  const query = {
    text: `
      INSERT INTO
        notifications(user_id, actor_id, type, content_id, subject_id, interaction_id)
      SELECT
        recipient.author_id, actor.id, $2, $3, $4::INT, $5::INT
      FROM
        users actor,
        (${recipientOf[type]}) recipient
      WHERE
        actor.pid = $1
      AND
        recipient.author_id <> actor.id
      ;`,
    values: [actor_pid, type, content_id, subject_id ?? null, interaction_id ?? null]
  }

  await db.query(query)
}

// Called once the action itself is saved (and its git write done), so a notification never points
// to something that was rolled back. Failing to notify is logged and doesn't fail the action, which
// the user would otherwise retry, duplicating it.
export async function notify(request: NotifyRequest): Promise<void> {
  try {
    await create(request)
  }
  catch (err) {
    logger.error({ err, notification: request }, "[notifications.ts] Failed to notify")
  }
}

export interface Notification {
  id: number,
  type: NotificationType,
  read: boolean,
  created_at: Date,
  actor: { name: string, avatar: string },
  // The topic or post it's about, and the topic it belongs to, for links
  content: { id: number, title: string, type: string },
  topic_id: number,
  subject: { id: number, title: string, type: string, commit: string | null } | null,
  suggestion: { message: string, commit: string } | null
}

interface FindOptions {
  page: number,
  pageSize: number,
  unread?: boolean
}

async function findByUser(user_pid: string, { page, pageSize, unread = false }: FindOptions): Promise<{ notifications: Notification[], count: number }> {
  const query = {
    text: `
      SELECT
        n.id::INT,
        n.type,
        n.read_at IS NOT NULL AS read,
        n.created_at,
        json_build_object('name', users.name, 'avatar', ${AVATAR_BASE64}) AS actor,
        json_build_object('id', c.id, 'title', c.title, 'type', c.type) AS content,
        CASE WHEN c.type = 'topic' THEN c.id ELSE c.parent_id END AS topic_id,
        CASE WHEN s.id IS NULL THEN NULL ELSE
          json_build_object('id', s.id, 'title', s.title, 'type', s.type, 'commit', s.config->>'commit')
        END AS subject,
        CASE WHEN i.id IS NULL THEN NULL ELSE
          json_build_object('message', i.config->>'message', 'commit', i.config->>'commit')
        END AS suggestion,
        COUNT(*) OVER ()::INT AS total_count
      FROM
        notifications n
      INNER JOIN
        users ON users.id = n.actor_id
      INNER JOIN
        contents c ON c.id = n.content_id
      LEFT JOIN
        contents s ON s.id = n.subject_id
      LEFT JOIN
        interactions i ON i.id = n.interaction_id
      WHERE
        n.user_id = (SELECT id FROM users WHERE pid = $1)
      ${unread ? "AND n.read_at IS NULL" : ""}
      ORDER BY
        n.id DESC
      ${limitOffset(page, pageSize)}
      ;`,
    values: [user_pid]
  }

  const result = await db.query(query)
  const count = result.rows[0]?.total_count ?? (page > 1 ? await countFor(user_pid, unread) : 0)

  return { notifications: result.rows.map(({ total_count, ...notification }) => notification), count }
}

// A page past the end has no rows to carry the total, so it's counted on its own
async function countFor(user_pid: string, unread: boolean): Promise<number> {
  const query = {
    text: `
      SELECT
        COUNT(*)::INT
      FROM
        notifications
      WHERE
        user_id = (SELECT id FROM users WHERE pid = $1)
      ${unread ? "AND read_at IS NULL" : ""}
      ;`,
    values: [user_pid]
  }

  const result = await db.query(query)
  return result.rows[0].count
}

const countUnread = (user_pid: string) => countFor(user_pid, true)

// Marks the given notifications of the user as read, or all of them when `ids` is omitted. Others'
// notifications are left alone, whatever ids are given.
async function markRead(user_pid: string, ids?: number[]): Promise<number> {
  const query = {
    text: `
      UPDATE
        notifications
      SET
        read_at = now()
      WHERE
        user_id = (SELECT id FROM users WHERE pid = $1)
      AND
        read_at IS NULL
      ${ids ? "AND id = ANY($2::BIGINT[])" : ""}
      ;`,
    values: ids ? [user_pid, ids] : [user_pid]
  }

  const result = await db.query(query)
  return result.rowCount ?? 0
}

export default Object.freeze({
  create,
  findByUser,
  countUnread,
  markRead
})
