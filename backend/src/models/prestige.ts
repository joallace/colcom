import { PRESTIGE_LIMITS, PRESTIGE_REASONS, PrestigeLimit, PrestigeReason } from "@colcom/shared"

import db from "@/pgDatabase"
import { RateLimit } from "@/config"
import { limitOffset } from "@/pagination"


// An award as a profile lists it: by which rule, what was credited (`amount`) of what the rule gave
// (`rule_amount`) and what held it back (`limited`), who confirmed it and what it's about
export interface PrestigeEvent {
  id: number,
  reason: PrestigeReason,
  amount: number,
  rule_amount: number,
  limited: PrestigeLimit | null,
  created_at: Date,
  counterpart: { pid: string, name: string } | null,
  // The critique it's about, or none for a suggestion, and the post and topic of either
  critique: { id: number, title: string } | null,
  post: { id: number, title: string } | null,
  topic: { id: number, title: string } | null,
  suggestion: { id: number, message: string } | null
}

// What each rule is worth and how much can be earned; a null limit is lifted. `window` is in seconds.
export interface PrestigeRules {
  rules: { reason: PrestigeReason, amount: number }[],
  limits: Record<PrestigeLimit, { cap: number, window: number } | null>
}

// A user's awards, newest first
async function history(user_pid: string, { page, pageSize }: { page: number, pageSize: number }): Promise<{ events: PrestigeEvent[], count: number }> {
  const query = {
    text: `
      SELECT
        e.id::INT,
        e.reason,
        e.amount,
        e.rule_amount,
        e.limited,
        e.created_at,
        CASE WHEN other.id IS NULL THEN NULL ELSE json_build_object('pid', other.pid, 'name', other.name) END AS counterpart,
        CASE WHEN target.type = 'critique' THEN json_build_object('id', target.id, 'title', target.title) END AS critique,
        CASE WHEN post.id IS NULL THEN NULL ELSE json_build_object('id', post.id, 'title', post.title) END AS post,
        CASE WHEN topic.id IS NULL THEN NULL ELSE json_build_object('id', topic.id, 'title', topic.title) END AS topic,
        CASE WHEN fix.id IS NULL THEN NULL ELSE json_build_object('id', fix.id, 'message', fix.config->>'message') END AS suggestion,
        COUNT(*) OVER ()::INT AS total_count
      FROM
        prestige_events e
      LEFT JOIN
        users AS other ON other.id = e.counterpart_id
      LEFT JOIN
        contents AS target ON target.id = e.content_id
      LEFT JOIN
        contents AS post ON post.id = CASE WHEN target.type = 'critique' THEN target.parent_id ELSE target.id END
      LEFT JOIN
        contents AS topic ON topic.id = post.parent_id
      LEFT JOIN
        interactions AS fix ON fix.id = e.suggestion_id
      WHERE
        e.user_id = (SELECT id FROM users WHERE pid = $1)
      ORDER BY
        e.created_at DESC, e.id DESC
      ${limitOffset(page, pageSize)}
      ;`,
    values: [user_pid]
  }

  const result = await db.query(query)
  const count = result.rows[0]?.total_count ?? (page > 1 ? await countFor(user_pid) : 0)
  return { events: result.rows.map(({ total_count, ...event }) => event), count }
}

// A page past the end has no rows to carry the total, so it's counted on its own
async function countFor(user_pid: string): Promise<number> {
  const result = await db.query({
    text: "SELECT COUNT(*)::INT FROM prestige_events WHERE user_id = (SELECT id FROM users WHERE pid = $1);",
    values: [user_pid]
  })
  return result.rows[0].count
}

// The rules in PRESTIGE_REASONS' order (any the operator added after them), and the limits
async function rules(): Promise<PrestigeRules> {
  const [rules, limits] = await Promise.all([
    db.query({
      text: "SELECT reason, amount FROM prestige_rules ORDER BY array_position($1::TEXT[], reason) NULLS LAST, reason;",
      values: [PRESTIGE_REASONS]
    }),
    db.query("SELECT name, cap, window_seconds FROM prestige_limits;")
  ])

  const set = Object.fromEntries(limits.rows.map(({ name, cap, window_seconds }) =>
    [name, cap === null ? null : { cap, window: window_seconds }]
  ))
  return {
    rules: rules.rows,
    limits: Object.fromEntries(PRESTIGE_LIMITS.map(name => [name, set[name] ?? null])) as PrestigeRules["limits"]
  }
}

// Writes the limits set in .env (config.prestige) where the awards read them. A lifted one keeps a
// window, which nothing reads while its cap is null.
async function applyLimits(limits: Record<PrestigeLimit, RateLimit | null>): Promise<void> {
  const names = PRESTIGE_LIMITS
  await db.query({
    text: `
      INSERT INTO
        prestige_limits (name, cap, window_seconds)
      SELECT
        *
      FROM
        unnest($1::TEXT[], $2::INT[], $3::INT[])
      ON CONFLICT (name) DO UPDATE SET
        cap = EXCLUDED.cap,
        window_seconds = EXCLUDED.window_seconds
      ;`,
    values: [
      names,
      names.map(name => limits[name]?.max ?? null),
      names.map(name => Math.round((limits[name]?.windowMs ?? 86_400_000) / 1000))
    ]
  })
}

export default Object.freeze({
  history,
  rules,
  applyLimits
})
