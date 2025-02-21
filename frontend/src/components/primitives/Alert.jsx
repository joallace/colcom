import React from "react"
import { PiX } from "react-icons/pi"

export default ({ setter = () => { }, children }) => {
  if (!children) return

  const reset = () => { setter("") }

  return (
    <div className="alert">
      <div>
        {children}
      </div>
      <div>
        <PiX onClick={reset} />
      </div>
    </div>
  )
}