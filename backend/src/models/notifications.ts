import type { PrestigeLimit, PrestigeReason } from "@colcom/shared"

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
// - critique_addressed, critique_rebutted: the post's author answered their critique (content: the
//   post, subject: the critique)
// - critique_accepted, critique_disputed, critique_withdrawn: the critic acted on a critique of their
//   post (same)
export type NotificationType =
  | "critique" | "suggestion" | "suggestion_accepted" | "suggestion_rejected" | "post" | "clone"
  | "critique_addressed" | "critique_rebutted" | "critique_accepted" | "critique_disputed" | "critique_withdrawn"

// Also listed, but made by notifyAwards rather than notify:
// - prestige: an award no other notification told of, like the ones for accepting a fix or merging
//   a suggestion, from whoever confirmed it (content: the post, subject: the critique when it's about
//   one, interaction: the suggestion when it's about one)
type ListedType = NotificationType | "prestige"

export interface NotifyRequest {
  type: NotificationType,
  actor_pid: string,
  content_id: number,
  subject_id?: number,
  interaction_id?: number
}

// Who is told: the author of what the notification is about, except for an answer to a suggestion,
// which goes to whoever suggested it, and an answer to a critique, to the critic. Each query selects
// `author_id`.
const recipientOf: Record<NotificationType, string> = {
  critique: "SELECT author_id FROM contents WHERE id = $3",
  suggestion: "SELECT author_id FROM contents WHERE id = $3",
  suggestion_accepted: "SELECT author_id FROM interactions WHERE id = $5",
  suggestion_rejected: "SELECT author_id FROM interactions WHERE id = $5",
  post: "SELECT author_id FROM contents WHERE id = $3",
  clone: "SELECT author_id FROM contents WHERE id = $3",
  // The post's author answered: the critic is told
  critique_addressed: "SELECT author_id FROM contents WHERE id = $4",
  critique_rebutted: "SELECT author_id FROM contents WHERE id = $4",
  critique_accepted: "SELECT author_id FROM contents WHERE id = $3",
  critique_disputed: "SELECT author_id FROM contents WHERE id = $3",
  critique_withdrawn: "SELECT author_id FROM contents WHERE id = $3"
}

// The prestige an answer tells its recipient they earned, when the contribution answered earned some:
// the author's, for an answer to a critique the critic accepted; the suggester's, for a merged
// suggestion. Each query selects the `award` from prestige_events; `recipient` is the one told.
const awardOf: Partial<Record<NotificationType, string>> = {
  critique_accepted: "SELECT award.id FROM prestige_events award WHERE award.user_id = recipient.author_id AND award.content_id = $4 AND award.reason IN ('fix_accepted', 'rebuttal_accepted')",
  suggestion_accepted: "SELECT award.id FROM prestige_events award WHERE award.user_id = recipient.author_id AND award.suggestion_id = $5"
}

// An award is told once, so one a notification already tells of is left out
const awardSql = (type: NotificationType) => awardOf[type] ? `(
  ${awardOf[type]}
  AND NOT EXISTS (SELECT 1 FROM notifications told WHERE told.prestige_event_id = award.id)
  ORDER BY award.id DESC
  LIMIT 1
)` : "NULL"

async function create({ type, actor_pid, content_id, subject_id, interaction_id }: NotifyRequest): Promise<void> {
  const query = {
    text: `
      INSERT INTO
        notifications(user_id, actor_id, type, content_id, subject_id, interaction_id, prestige_event_id)
      SELECT
        recipient.author_id, actor.id, $2, $3, $4::INT, $5::INT, ${awardSql(type)}
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

interface AwardsRequest {
  // The critique event, or the suggestion, whose awards are told
  critique_event_id?: number,
  suggestion_id?: number
}

// Tells everyone what an event awarded them that no notification of it told: the prestige earned by
// their own action (accepting a fix, merging a suggestion), as told by whoever confirmed it. Called
// after the event's other notifications, so the awards those tell of aren't told twice. Awards are
// written by the database (init.sql), so they exist once the event does.
async function createAwards({ critique_event_id, suggestion_id }: AwardsRequest): Promise<void> {
  const query = {
    text: `
      INSERT INTO
        notifications(user_id, actor_id, type, content_id, subject_id, interaction_id, prestige_event_id)
      SELECT
        award.user_id,
        award.counterpart_id,
        'prestige',
        -- The post, and the critique when it's about one
        CASE WHEN target.type = 'critique' THEN target.parent_id ELSE target.id END,
        CASE WHEN target.type = 'critique' THEN target.id END,
        award.suggestion_id,
        award.id
      FROM
        prestige_events award
      INNER JOIN
        contents target ON target.id = award.content_id
      WHERE
        (award.critique_event_id = $1 OR award.suggestion_id = $2)
      AND
        award.counterpart_id IS NOT NULL
      AND
        NOT EXISTS (SELECT 1 FROM notifications told WHERE told.prestige_event_id = award.id)
      ORDER BY
        award.id
      ON CONFLICT DO NOTHING
      ;`,
    values: [critique_event_id ?? null, suggestion_id ?? null]
  }

  await db.query(query)
}

// Like notify, a failure is logged and doesn't fail the action
export async function notifyAwards(request: AwardsRequest): Promise<void> {
  try {
    await createAwards(request)
  }
  catch (err) {
    logger.error({ err, awards: request }, "[notifications.ts] Failed to notify awards")
  }
}

export interface Notification {
  id: number,
  type: ListedType,
  read: boolean,
  created_at: Date,
  actor: { name: string, avatar: string },
  // The topic or post it's about, and the topic it belongs to, for links
  content: { id: number, title: string, type: string },
  topic_id: number,
  subject: { id: number, title: string, type: string, commit: string | null } | null,
  suggestion: { message: string, commit: string } | null,
  // The prestige it tells the recipient they earned: what was credited of the rule's amount, and
  // what held it back
  prestige: { reason: PrestigeReason, amount: number, rule_amount: number, limited: PrestigeLimit | null } | null
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
        CASE WHEN award.id IS NULL THEN NULL ELSE
          json_build_object('reason', award.reason, 'amount', award.amount, 'rule_amount', award.rule_amount, 'limited', award.limited)
        END AS prestige,
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
      LEFT JOIN
        prestige_events award ON award.id = n.prestige_event_id
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
