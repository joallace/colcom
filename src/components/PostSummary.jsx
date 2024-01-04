import React from "react"
import { Link } from "react-router-dom"

export default ({id, summary, percentage, shortAnswer}) => {
    return (
        <div>
          <div className="post-percentage-bar" style={{ width: `${percentage}%` }}>
            <span>{shortAnswer ? shortAnswer : `${index + 1}.`}</span>
            <span>{`${percentage}%`}</span>
          </div>
          {summary}
          <Link className="unselectable read-more" to={`/post/${id}`}>continuar...</Link>
        </div>
      )
}