import React from "react"
import { useFloating, autoUpdate, offset, shift, limitShift } from "@floating-ui/react-dom"

import { reservedHeight } from "@/assets/reservedHeight"


const GAP = 24
const VIEWPORT_PADDING = 16

// Keeps the open critiques beside the post, level with the passage they criticise, while the page
// scrolls, resizes or the post's text reflows. `getPost` returns the post's frame and `getAnchor`
// the element marking the passage; both are looked up on every update, because the editor
// re-renders its highlights (replacing those elements) while a critique is open.
export default function CritiquePopover({ getPost, getAnchor, children }) {
  const [floating, setFloating] = React.useState(null)
  const reference = React.useMemo(() => ({
    get contextElement() {
      return getPost()
    },
    getBoundingClientRect() {
      const column = getPost().getBoundingClientRect()
      const passage = getAnchor()?.getBoundingClientRect() ?? column

      // The post column's horizontal extent with the passage's vertical one, so the critiques
      // sit to the right of the whole post rather than next to the highlighted words
      return {
        x: column.x,
        y: passage.y,
        left: column.left,
        right: column.right,
        width: column.width,
        top: passage.top,
        bottom: passage.bottom,
        height: passage.height
      }
    }
  }), [getPost, getAnchor])

  const { floatingStyles, middlewareData } = useFloating({
    placement: "right-start",
    elements: { reference, floating },
    middleware: [
      offset(GAP),
      // Slides along the post to stay in view, but never past the passage it belongs to, nor beyond
      // the post itself (e.g. over the timeline above it). A stack taller than the visible part of
      // the post stays at the post's top and extends downwards, where it can be scrolled to.
      shift(() => ({ boundary: getPost(), padding: VIEWPORT_PADDING, limiter: limitShift() })),
      reservedHeight
    ],
    whileElementsMounted: autoUpdate
  })

  // Positioned absolutely, the popover takes no room in the page, so a long stack would run over
  // what follows the post (the footer). Its column, which is its offset parent, is stretched down
  // to where it ends.
  return (
    <div className="critiquePopoverColumn" style={{ minHeight: middlewareData.reservedHeight?.bottom }}>
      <div ref={setFloating} className="critiquePopover" style={floatingStyles}>
        {children}
      </div>
    </div>
  )
}
