import React from "react"
import { PiXBold } from "react-icons/pi"

export default function Modal({ isOpen = false, setIsOpen = () => { }, children, title, footer, ...remainingProps }) {
  const handleClickOutside = (e) => {
    const { target, currentTarget } = e
    e.preventDefault()
    if (target === currentTarget)
      setIsOpen(false)
  }

  if (!isOpen)
    return

  return (
    <div className="backdrop" onClick={handleClickOutside}>
      <div className="modal">
        <div className="header" style={{ justifyContent: !title && "right" }}>
          {title}
          <PiXBold className="icon" onClick={() => { setIsOpen(false) }} />
        </div>
        {/* <hr/> */}
        {children}
        {/* <hr /> */}
        {footer &&
          <div className="footer">
            {...footer}
          </div>
        }
      </div>
    </div>
  )
}