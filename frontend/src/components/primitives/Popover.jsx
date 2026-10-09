import React from "react"
import {
  useFloating,
  useClick,
  useDismiss,
  useRole,
  useInteractions,
  FloatingPortal,
  FloatingFocusManager,
  autoUpdate,
  offset,
  flip,
  shift,
  size
} from "@floating-ui/react"


const GAP = 8
const VIEWPORT_PADDING = 8

// A panel opened by clicking its trigger, a button holding `children` (other props, like
// `className` or `aria-label`, go to it), and closed by clicking it again, clicking outside or
// pressing Escape, which returns the focus to the trigger. It stays in view (flipping and
// shifting) and is drawn in a portal, so no container's overflow or stacking cuts it. `content` is
// rendered only while open (so it may fetch on mount), as a node or a function of `{ close }`, for
// links inside that navigate away. `open`/`onOpenChange` make it controlled; `heading` names the
// dialog and heads the panel, and `panelClassName` styles it.
export default function Popover({
  children,
  content,
  heading,
  placement = "bottom",
  panelClassName,
  open: controlledOpen,
  onOpenChange: setControlledOpen,
  className,
  ...triggerProps
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = setControlledOpen ?? setUncontrolledOpen
  // In state rather than Floating UI's `refs`, which the React Compiler's lint reads as refs
  // accessed during render
  const [reference, setReference] = React.useState(null)
  const [floating, setFloating] = React.useState(null)
  const headingId = React.useId()

  const { floatingStyles, context } = useFloating({
    open,
    onOpenChange: setOpen,
    placement,
    elements: { reference, floating },
    middleware: [
      offset(GAP),
      flip({ padding: VIEWPORT_PADDING }),
      shift({ padding: VIEWPORT_PADDING }),
      // Never wider or taller than the room left on screen; its content scrolls instead
      size({
        padding: VIEWPORT_PADDING,
        apply({ availableWidth, availableHeight, elements }) {
          elements.floating.style.setProperty("--popover-max-width", `${Math.max(0, availableWidth)}px`)
          elements.floating.style.setProperty("--popover-max-height", `${Math.max(0, availableHeight)}px`)
        }
      })
    ],
    whileElementsMounted: autoUpdate
  })

  const { getReferenceProps, getFloatingProps } = useInteractions([
    useClick(context),
    useDismiss(context),
    useRole(context, { role: "dialog" })
  ])

  const close = () => setOpen(false)

  return (
    <>
      <button
        type="button"
        ref={setReference}
        className={`popoverTrigger${className ? ` ${className}` : ""}`}
        {...getReferenceProps(triggerProps)}
      >
        {children}
      </button>
      {open &&
        <FloatingPortal>
          <FloatingFocusManager context={context} modal={false}>
            <div
              ref={setFloating}
              className="popover"
              style={floatingStyles}
              aria-labelledby={heading ? headingId : undefined}
              {...getFloatingProps()}
            >
              {/* Floating UI moves the outer element with `transform`, so the entrance animates this one */}
              <div className={`panel${panelClassName ? ` ${panelClassName}` : ""}`} data-placement={context.placement}>
                {heading && <h2 id={headingId} className="heading">{heading}</h2>}
                {typeof content === "function" ? content({ close }) : content}
              </div>
            </div>
          </FloatingFocusManager>
        </FloatingPortal>
      }
    </>
  )
}
