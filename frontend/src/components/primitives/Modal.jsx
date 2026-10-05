import { PiXBold } from "react-icons/pi"

export default function Modal({ isOpen = false, setIsOpen = () => { }, children, title, ...remainingProps }) {
  if (!isOpen)
    return

  return (
    <div className="backdrop">
      <div className="modal" {...remainingProps}>
        <div className="header" style={{ justifyContent: !title && "right" }}>
          {title}
          <PiXBold className="icon clickable" onClick={() => { setIsOpen(false) }} />
        </div>
        {children}
      </div>
    </div>
  )
}