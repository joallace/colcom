// A Floating UI middleware reporting where the floating element ends, in its offset parent's
// coordinates. Placed last, it sees where every other middleware moved it. An absolutely positioned
// element takes no room in the page, so its offset parent can be given this height to hold it.
export const reservedHeight = {
  name: "reservedHeight",
  fn: ({ y, rects }) => ({ data: { bottom: Math.ceil(y + rects.floating.height) } })
}
