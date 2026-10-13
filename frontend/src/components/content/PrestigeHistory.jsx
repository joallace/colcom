import { Link } from "react-router"

import { amountText, describePrestige } from "@/assets/prestige"
import { relativeTime, userPath } from "@/assets/util"


// One award: what it credited, for what, who confirmed it and when, and what held it back if anything
function PrestigeItem({ event }) {
  const { label, target, path, context, by, held } = describePrestige(event)

  return (
    <li>
      <span className={`prestigeAmount${event.amount < 0 ? " negative" : event.amount === 0 ? " none" : ""}`}>
        {amountText(event.amount)}
      </span>
      <div>
        <p>
          <strong>{label}</strong>
          {target && <>: {path ? <Link to={path}>{target}</Link> : target}</>}
        </p>
        {context && <p className="detail">{event.critique ? `em ${context}` : context}</p>}
        <p className="detail">
          {by && <>{by} <Link to={userPath(event.counterpart.name)}>{event.counterpart.name}</Link> · </>}
          <time dateTime={event.created_at}>{relativeTime(event.created_at)}</time>
        </p>
        {held && <p className="detail"><Link to="/prestige">{held}</Link></p>}
      </div>
    </li>
  )
}

// A profile's prestige history (GET /users/:name/prestige), newest first: where every point came from
export default function PrestigeHistory({ events }) {
  return (
    <ol className="prestigeHistory" aria-label="histórico de prestígio">
      {events.map(event => <PrestigeItem key={event.id} event={event} />)}
    </ol>
  )
}
