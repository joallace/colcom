import React from "react"
import { Link } from "react-router"

import LoadingButton from "@/components/primitives/LoadingButton"
import api, { ApiError } from "@/assets/api"
import { formErrors, limits } from "@/assets/validation"
import { relativeTime, userPath } from "@/assets/util"
import {
  ACTIONS,
  STATE_DESCRIPTIONS,
  STATE_LABELS,
  critiqueActions,
  describeEvent,
  laterVersions,
  suggestionState
} from "@/assets/critiques"


export const CritiqueStatus = ({ status = "open" }) => (
  <span className="critiqueStatus" data-status={status} title={STATE_DESCRIPTIONS[status]}>
    {STATE_LABELS[status] ?? status}
  </span>
)

const versionLabel = version => `${relativeTime(version.date)}${version.subject ? `: ${version.subject}` : ""}`

// The form for one action. Addressing names the version that fixes the critique, the latest by default.
function ActionForm({ id, action, versions, onDone, onCancel }) {
  const [note, setNote] = React.useState("")
  const [commit, setCommit] = React.useState(versions[0]?.commit ?? "")
  const [errors, setErrors] = React.useState({})
  const [isLoading, setIsLoading] = React.useState(false)
  const { submit, note: noteLabel } = ACTIONS[action]

  const send = async () => {
    const values = { action, ...(note.trim() ? { note: note.trim() } : {}), ...(action === "address" ? { commit } : {}) }
    const invalid = formErrors("critiqueEvent", values)
    if (Object.keys(invalid).length > 0) {
      setErrors(invalid)
      return
    }

    try {
      setIsLoading(true)
      onDone(await api.post(`/contents/${id}/events`, values))
    }
    catch (err) {
      if (!(err instanceof ApiError)) {
        console.error(err)
        return
      }
      setErrors({ [err.key ?? "form"]: err.message?.toLowerCase() })
    }
    finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="critiqueActionForm">
      {action === "address" &&
        (versions.length > 0 ?
          <label>
            versão que corrige
            <select value={commit} onChange={e => setCommit(e.target.value)}>
              {versions.map(version => <option key={version.commit} value={version.commit}>{versionLabel(version)}</option>)}
            </select>
          </label>
          :
          <p className="hint">Edite o post para corrigir o trecho; a nova versão poderá ser indicada aqui.</p>
        )
      }
      {errors.commit && <span className="error">{errors.commit}!</span>}
      <label>
        {noteLabel}
        <textarea value={note} maxLength={limits.critiqueNote.max} rows={3} onChange={e => { setNote(e.target.value); setErrors({}) }} />
      </label>
      {(errors.note || errors.form) && <span className="error">{errors.note ?? errors.form}!</span>}
      <div className="buttons">
        <button className="error" onClick={onCancel}>cancelar</button>
        <LoadingButton isLoading={isLoading} disabled={action === "address" && versions.length === 0} onClick={send}>
          {submit}
        </LoadingButton>
      </div>
    </div>
  )
}

const Event = ({ event, versionPath }) => (
  <li className="critiqueEvent" data-action={event.action}>
    <div className="description">
      <img src={`data:image/png;base64,${event.actor.avatar}`} alt="" />
      <span>
        <Link to={userPath(event.actor.name)}>{event.actor.name}</Link> {describeEvent(event)}
        {event.commit && <> na <Link to={versionPath(event.commit)}>versão {event.commit.slice(0, 7)}</Link></>}
      </span>
      <span className="time">{relativeTime(event.created_at)}</span>
    </div>
    {event.action === "suggest" && event.suggestion &&
      <p className="suggestedFix">
        &quot;{event.suggestion.message}&quot; <span>({suggestionState(event.suggestion.accepted)})</span>
      </p>
    }
    {event.note && <p className="note">{event.note}</p>}
  </li>
)

// A critique's state, what its author and critic said about it, and the actions the viewer may take.
// `onChange` receives the critique's new { status, events }.
export default function CritiqueThread({ id, status = "open", events = [], critiqueCommit, isAuthor, isCritic, history, onChange }) {
  const [action, setAction] = React.useState()
  const actions = critiqueActions(status, { isAuthor, isCritic })
  const versionPath = commit => `?${new URLSearchParams({ commit, critique: id })}`

  return (
    <section className="critiqueThread" aria-label="andamento da crítica">
      <div className="critiqueStatusLine">
        <CritiqueStatus status={status} />
        <span className="hint">{STATE_DESCRIPTIONS[status]}</span>
      </div>

      {events.length > 0 &&
        <ol className="critiqueEvents">
          {events.map(event => <Event key={event.id} event={event} versionPath={versionPath} />)}
        </ol>
      }

      {action ?
        <ActionForm
          key={action}
          id={id}
          action={action}
          versions={laterVersions(history, critiqueCommit)}
          onCancel={() => setAction()}
          onDone={thread => { setAction(); onChange(thread) }}
        />
        :
        actions.length > 0 &&
          <div className="critiqueActions">
            {actions.map(name =>
              <button key={name} className={name === "withdraw" ? "error" : undefined} onClick={() => setAction(name)}>
                {ACTIONS[name].label}
              </button>
            )}
          </div>
      }
      {isCritic && !isAuthor && actions.includes("withdraw") &&
        <p className="hint">Para sugerir uma correção, edite o post e indique esta crítica ao enviar.</p>
      }
    </section>
  )
}
