import { describe, expect, it } from "vitest"
// Floating UI's core computes positions on any platform, without the DOM
import { computePosition, offset, shift } from "@floating-ui/core"

import { reservedHeight } from "@/assets/reservedHeight"


// jsdom has no layout, so the elements' rectangles are given by a stub platform
const rect = (x, y, width, height) => ({ x, y, width, height })
const platform = ({ reference, floating }) => ({
  getElementRects: () => ({ reference, floating }),
  getClippingRect: () => rect(0, 0, 10000, 10000),
  getDimensions: () => ({ width: floating.width, height: floating.height })
})

describe("reservedHeight", () => {
  it("reports the floating element's bottom", () => {
    const { data } = reservedHeight.fn({ y: 40, rects: { floating: rect(0, 0, 300, 1287.5) } })

    expect(data.bottom).toBe(1328)
  })

  it("reports where the floating element ends after the other middleware moved it", async () => {
    // A stack of critiques much taller than the post it sits beside, as when it ran over the footer
    const rects = { reference: rect(0, 100, 800, 20), floating: rect(0, 0, 400, 1300) }

    const { y, middlewareData } = await computePosition({}, {}, {
      placement: "right-start",
      platform: platform(rects),
      middleware: [offset(24), shift(), reservedHeight]
    })

    expect(y).toBe(100)
    expect(middlewareData.reservedHeight.bottom).toBe(1400)
  })
})
