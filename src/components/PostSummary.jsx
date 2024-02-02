import React from "react"
import { Link, useNavigate } from "react-router-dom"

export default ({ parent_id, id, summary, percentage, shortAnswer }) => {
  const path = `/topics/${parent_id}/posts/${id}`

  return (
    <div className="postSummary">
      <Link to={path} style={{ width: `${percentage}%` }}>
        <div className="percentageBar">
          <span>{shortAnswer ? shortAnswer : `${index + 1}.`}</span>
          <span>{`${percentage}%`}</span>
        </div>
      </Link>
      {summary}
      {/* <Link className="unselectable read-more" to={path}>continuar...</Link> */}
    </div>
  )
}