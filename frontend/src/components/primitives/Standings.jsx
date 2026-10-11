import { ordinal } from "@/assets/podium"


// A ranking: the first three on a podium's steps, the first in the middle, and the rest in rows under
// them. `entries` come in ranking order, each with a `key` and its `position`; equal ones share a
// position, and so their step's height. `renderEntry` draws who or what an entry is, `renderScore`
// what put it there.
export default function Standings({ entries, label, renderEntry, renderScore }) {
  return (
    // Safari drops the list role of a list without bullets
    <ol className="standings" aria-label={label} role="list">
      {entries.map((entry, index) => index < 3 ?
        <li key={entry.key} value={entry.position} className={`step slot${index + 1} place${entry.position}`}>
          <div className="standingEntry">{renderEntry(entry)}</div>
          <div className="stepBlock">
            <span className="standingPosition">{ordinal(entry.position)}</span>
            <span className="standingScore">{renderScore(entry)}</span>
          </div>
        </li>
        :
        <li key={entry.key} value={entry.position} className="row">
          <span className="standingPosition">{ordinal(entry.position)}</span>
          <div className="standingEntry">{renderEntry(entry)}</div>
          <span className="standingScore">{renderScore(entry)}</span>
        </li>
      )}
    </ol>
  )
}
