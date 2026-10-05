import { PiX } from "react-icons/pi"

export default function Alert({ setter = () => { }, children }) {
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