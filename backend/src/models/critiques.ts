import type { CritiqueAction, CritiqueState } from "@colcom/shared"

import db from "@/pgDatabase"
import { ConflictError } from "@/errors"


// What can happen to a critique: the lifecycle's actions, a fix the critic attached ('suggest') and
// that fix merged by the post's author ('merge')
type CritiqueEventAction = CritiqueAction | "suggest" | "merge"

interface CritiqueEvent {
  id: number,
  action: CritiqueEventAction,
  from: CritiqueState,
  to: CritiqueState,
  note: string | null,
  commit: string | null,
  actor: { pid: string, name: string, avatar: string },
  // The attached or merged fix, as it stands now
  suggestion: { id: number, message: string, commit: string, accepted: boolean | null } | null,
  created_at: Date
}

interface EventRequest {
  critique_id: number,
  actor_pid: string,
  action: CritiqueEventAction,
  // The state the actor saw; if it changed since, the event is refused
  from: CritiqueState,
  to: CritiqueState,
  note?: string,
  commit?: string,
  suggestion_id?: number
}

// A critique's events, oldest first, as a JSON array built by SQL: lists of critiques carry their
// whole thread in the same query
export const critiqueEventsSql = (critiqueId: string) => `(
  SELECT
    COALESCE(json_agg(json_build_object(
      'id', e.id::INT,
      'action', e.action,
      'from', e.from_status,
      'to', e.to_status,
      'note', e.note,
      'commit', e.commit,
      -- The avatar as AVATAR_BASE64 (models/content.ts) encodes it
      'actor', json_build_object('pid', actor.pid, 'name', actor.name, 'avatar', translate(encode(actor.avatar, 'base64'), E'\\n', '')),
      'suggestion', CASE WHEN fix.id IS NULL THEN NULL ELSE json_build_object(
        'id', fix.id,
        'message', fix.config->>'message',
        'commit', fix.config->>'commit',
        'accepted', (fix.config->'accepted')
      ) END,
      'created_at', e.created_at
    ) ORDER BY e.id), '[]'::json)
  FROM
    critique_events e
  INNER JOIN
    users AS actor ON actor.id = e.user_id
  LEFT JOIN
    interactions AS fix ON fix.id = e.suggestion_id
  WHERE
    e.critique_id = ${critiqueId}
)`

// Records an event, which moves the critique to `to` (the critique_events_apply trigger). A 409 when
// the critique is no longer in the state the actor saw.
async function record({ critique_id, actor_pid, action, from, to, note, commit, suggestion_id }: EventRequest): Promise<void> {
  const query = {
    text: `
      INSERT INTO
        critique_events(critique_id, user_id, action, from_status, to_status, note, commit, suggestion_id)
      SELECT
        $1, users.id, $3, $4, $5, $6, $7, $8
      FROM
        users
      WHERE
        users.pid = $2
      ;`,
    values: [critique_id, actor_pid, action, from, to, note ?? null, commit ?? null, suggestion_id ?? null]
  }

  await db.query(query).catch(err => {
    if (err?.code === "CC409")
      throw new ConflictError({
        message: "A crítica mudou de estado enquanto você respondia.",
        action: "Atualize a página para ver o estado atual.",
        errorLocationCode: "MODEL:CRITIQUES:RECORD:STATE_CHANGED"
      })
    throw err
  })
}

// A critique's state and thread, as the post page shows them
async function findThread(critique_id: number): Promise<{ id: number, status: CritiqueState, events: CritiqueEvent[] }> {
  const query = {
    text: `
      SELECT
        contents.id,
        contents.status,
        ${critiqueEventsSql("contents.id")} AS events
      FROM
        contents
      WHERE
        contents.id = $1
      AND
        contents.type = 'critique'
      ;`,
    values: [critique_id]
  }

  const result = await db.query(query)
  return result.rows[0]
}

export default Object.freeze({
  record,
  findThread
})

export { CritiqueEvent, CritiqueEventAction }
