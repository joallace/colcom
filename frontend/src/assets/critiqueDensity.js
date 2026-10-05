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

// Overlapping critiques are drawn as a single highlight that opens all of them. Each group is
// split into segments shaded by how many of its critiques cover them; a segment whose passage was
// edited since one of its critiques was made is drawn as "changed".
export function groupOverlappingMarks(critiques) {
  const marks = critiques
    .map((critique, i) => ({ ...critique.anchor, index: i }))
    .filter(mark => mark.match !== "removed")
    .sort((a, b) => a.from - b.from)

  const groups = []

  for (const mark of marks) {
    const current = groups.at(-1)

    if (current && mark.from < current.to) {
      current.to = Math.max(current.to, mark.to)
      current.index.push(mark.index)
      current.marks.push(mark)
    }
    else
      groups.push({ from: mark.from, to: mark.to, index: [mark.index], marks: [mark] })
  }

  return groups.map(({ from, to, index, marks }) => ({
    from,
    to,
    index,
    segments: densitySegments(marks).map(({ changed, ...segment }) => ({ ...segment, type: changed ? "changed" : "definitive" }))
  }))
}
