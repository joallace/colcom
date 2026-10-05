// Critique highlights are shaded by how many critiques cover each piece of text, so the most
// disputed passages stand out at a glance. Counts are bucketed on a doubling scale (1, 2, 3–4,
// 5–8, 9+): readers compare shades roughly, and exact counts are one click away.
export const CRITIQUE_LEVELS = ["1", "2", "3–4", "5–8", "9+"]

export function critiqueLevel(count) {
  return Math.min(CRITIQUE_LEVELS.length, 1 + Math.ceil(Math.log2(count)))
}

// Splits overlapping marks ({ from, to, match }) at every boundary, giving each piece the number
// of marks covering it and whether any of them was edited since it was made ("fuzzy")
export function densitySegments(marks) {
  const bounds = [...new Set(marks.flatMap(({ from, to }) => [from, to]))].sort((a, b) => a - b)
  const segments = []

  for (let i = 0; i < bounds.length - 1; i++) {
    const [from, to] = [bounds[i], bounds[i + 1]]
    const covering = marks.filter(mark => mark.from <= from && mark.to >= to)

    if (covering.length > 0)
      segments.push({
        from,
        to,
        level: critiqueLevel(covering.length),
        changed: covering.some(mark => mark.match === "fuzzy")
      })
  }

  return segments
}
