import React from "react"

export default function Modal({ isOpen = false, toggle = ()=>{}, children, ...remainingProps }) {
  if (isOpen)
    return (
      <div className="backdrop" onClick={toggle()}>
        {children}
      </div>
    )
}