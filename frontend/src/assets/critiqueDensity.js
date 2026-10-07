// Critique highlights are shaded by how many critiques cover each piece of text, so the most
// disputed passages stand out at a glance. Counts are bucketed on a doubling scale (1, 2, 3–4,
// 5–8, 9+): readers compare shades roughly, and exact counts are one click away.
export const CRITIQUE_LEVELS = ["1", "2", "3–4", "5–8", "9+"]

export function critiqueLevel(count) {
  return Math.min(CRITIQUE_LEVELS.length, 1 + Math.ceil(Math.log2(count)))
}

// How relevant readers found a critique: the lower bound of the 95% Wilson interval of its share
// of "relevant" votes. It's the share each critique shows, discounted when few voted, so one vote
// out of one doesn't outrank ninety out of a hundred.
export function relevanceScore({ upvotes = 0, downvotes = 0 }) {
  const n = upvotes + downvotes
  if (!n)
    return 0

  const z = 1.96
  const share = upvotes / n
  return (share + z * z / (2 * n) - z * Math.sqrt((share * (1 - share) + z * z / (4 * n)) / n)) / (1 + z * z / n)
}

// Most relevant first; sort is stable, so ties keep their order (the text's)
const byRelevance = marks => marks.toSorted((a, b) => b.relevance - a.relevance)

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
// edited since one of its critiques was made is drawn as "changed". A group's `index` lists its
// critiques by relevance; each segment's lists those covering it first, so the critique shown
// first when it's clicked is about the clicked words, then the rest, each part by relevance.
export function groupOverlappingMarks(critiques) {
  const marks = critiques
    .map((critique, i) => ({ ...critique.anchor, index: i, relevance: relevanceScore(critique) }))
    .filter(mark => mark.match !== "removed")
    .sort((a, b) => a.from - b.from)

  const groups = []

  for (const mark of marks) {
    const current = groups.at(-1)

    if (current && mark.from < current.to) {
      current.to = Math.max(current.to, mark.to)
      current.marks.push(mark)
    }
    else
      groups.push({ from: mark.from, to: mark.to, marks: [mark] })
  }

  return groups.map(({ from, to, marks }) => ({
    from,
    to,
    index: byRelevance(marks).map(mark => mark.index),
    segments: densitySegments(marks).map(({ changed, ...segment }) => {
      const covers = mark => mark.from <= segment.from && mark.to >= segment.to
      const order = [...byRelevance(marks.filter(covers)), ...byRelevance(marks.filter(mark => !covers(mark)))]

      return { ...segment, type: changed ? "changed" : "definitive", index: order.map(mark => mark.index) }
    })
  }))
}
