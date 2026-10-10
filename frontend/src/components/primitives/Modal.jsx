import React from "react"
import { PiXBold } from "react-icons/pi"

// A modal `<dialog>`. `showModal()` puts it in the browser's top layer, over the whole page even when
// it's rendered inside a transformed or clipped element (the critique popover, which Floating UI
// moves with `transform`, would otherwise become the containing block of a `position: fixed`
// backdrop). It stays where React renders it in the DOM, so events still bubble to its parents.
// The browser traps focus in it, closes it on Escape and gives focus back to what had it.
export default function Modal({ isOpen = false, setIsOpen = () => { }, children, title, className, ...remainingProps }) {
  const titleId = React.useId()

  if (!isOpen)
    return

  return (
    <Dialog
      className={`modal${className ? ` ${className}` : ""}`}
      aria-labelledby={title ? titleId : undefined}
      onClose={() => setIsOpen(false)}
      {...remainingProps}
    >
      <div className={`header${title ? "" : " untitled"}`}>
        {title && <span id={titleId}>{title}</span>}
        <button type="button" className="close" aria-label="fechar" onClick={() => setIsOpen(false)}>
          <PiXBold className="icon" />
        </button>
      </div>
      {children}
    </Dialog>
  )
}

// Opened as a modal when mounted and closed before it's removed, which hands focus back. Escape
// only asks the parent to close it (by unmounting it), so the parent's state stays the truth.
function Dialog({ onClose, children, ...props }) {
  const ref = React.useRef()

  React.useLayoutEffect(() => {
    const dialog = ref.current
    dialog.showModal()
    return () => dialog.close()
  }, [])

  // React bubbles `cancel` up its tree, so a nested dialog's (a chart's inside a critique's) would
  // close this one too
  const cancel = e => {
    if (e.target !== e.currentTarget)
      return
    e.preventDefault()
    onClose()
  }

  return (
    <dialog ref={ref} onCancel={cancel} {...props}>
      {children}
    </dialog>
  )
}
