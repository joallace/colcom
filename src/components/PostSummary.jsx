import React from "react"
import { Link, useNavigate } from "react-router-dom"

export default ({ parent_id, id, summary, percentage, shortAnswer, chosen }) => {
  const path = `/topics/${parent_id}/posts/${id}`

  return (
    <div className="postSummary">
      <Link to={path} style={{ width: `${percentage}%` }}>
        <div className={`percentageBar${chosen ? " chosen" : ""}`}>
          <span>{shortAnswer ? shortAnswer : `${index + 1}.`}</span>
          <span>{`${percentage.toFixed(2).replace(".00", "")}%`}</span>
        </div>
      </Link>
      {summary}
      {/* <Link className="unselectable read-more" to={path}>continuar...</Link> */}
    </div>
  )
}