import React from "react"
import { Link } from "react-router-dom"
import { PiStarFill, PiPencilSimpleLineFill } from "react-icons/pi"

import { toPercentageStr } from "@/assets/util"


export default ({ parent_id, id, summary, percentage, shortAnswer, chosen, isAuthor }) => {
  const path = `/topics/${parent_id}/posts/${id}`

  return (
    <div className="postSummary">
      <Link to={path} style={{ width: `${(30 + percentage*70) || 30}%` }}>
        <div className={`percentageBar${chosen ? " chosen" : ""}`}>
          <span>{chosen && <PiStarFill/>}{isAuthor && <PiPencilSimpleLineFill/>}{shortAnswer ? shortAnswer : `${index + 1}.`}</span>
          <span>{toPercentageStr(percentage)}</span>
        </div>
      </Link>
      {summary}
      {/* <Link className="unselectable read-more" to={path}>continuar...</Link> */}
    </div>
  )
}