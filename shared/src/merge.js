// A three-way merge of documents stored one block per line (see formatHtml in the backend), used
// when git refuses to merge a suggestion. git also counts changes on adjacent lines as a conflict
// (the author edited a paragraph, the suggestion added one right after it); here only changes to
// the same lines conflict, so the author is asked about passages both sides really changed.
// The backend commits a merge that has no conflicts; the frontend shows the conflicts to resolve.

// Lines keep their "\n", so joining them gives the text back exactly
export const splitLines = text => text.match(/[^\n]*\n|[^\n]+$/g) ?? []

// Past this many changed lines between two versions, they're compared as one block: Myers' trace
// grows with the square of the changes, and versions that different conflict anyway
const MAX_CHANGES = 1000

// The pairs of equal lines [i, j] of a longest common subsequence of a and b (Myers' algorithm),
// in order, or null when they differ in more than MAX_CHANGES lines
function commonLines(a, b) {
  const n = a.length, m = b.length, max = Math.min(n + m, MAX_CHANGES)
  const offset = max + 1
  const v = new Int32Array(2 * max + 3)
  // v as each round found it, for k in [-d - 1, d + 1]
  const trace = []

  for (let d = 0; d <= max; d++) {
    trace.push(v.slice(offset - d - 1, offset + d + 2))

    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || (k !== d && v[offset + k - 1] < v[offset + k + 1]) ? v[offset + k + 1] : v[offset + k - 1] + 1
      let y = x - k
      while (x < n && y < m && a[x] === b[y]) {
        x++
        y++
      }
      v[offset + k] = x

      if (x >= n && y >= m)
        return backtrack(trace, n, m)
    }
  }

  return null
}

function backtrack(trace, n, m) {
  const pairs = []
  let x = n, y = m

  for (let d = trace.length - 1; d >= 0; d--) {
    const v = trace[d]
    const at = k => v[k + d + 1]
    const k = x - y
    const previousK = k === -d || (k !== d && at(k - 1) < at(k + 1)) ? k + 1 : k - 1
    const previousX = at(previousK)
    const previousY = previousX - previousK

    while (x > previousX && y > previousY)
      pairs.push([--x, --y])

    x = previousX
    y = previousY
  }

  return pairs.reverse()
}

// What turns `a` into `b`, as hunks: a's lines [start, end) replaced by `lines`
export function diffLines(a, b) {
  let prefix = 0
  while (prefix < a.length && prefix < b.length && a[prefix] === b[prefix])
    prefix++

  let suffix = 0
  while (suffix < a.length - prefix && suffix < b.length - prefix && a[a.length - 1 - suffix] === b[b.length - 1 - suffix])
    suffix++

  const x = a.slice(prefix, a.length - suffix)
  const y = b.slice(prefix, b.length - suffix)
  // Lines compared as numbers
  const ids = new Map()
  const id = line => ids.get(line) ?? ids.set(line, ids.size).get(line)
  const pairs = x.length && y.length ? commonLines(x.map(id), y.map(id)) ?? [] : []

  const hunks = []
  let i = 0, j = 0
  for (const [mi, mj] of [...pairs, [x.length, y.length]]) {
    if (mi > i || mj > j)
      hunks.push({ start: prefix + i, end: prefix + mi, lines: y.slice(j, mj) })
    i = mi + 1
    j = mj + 1
  }

  return hunks
}

// Two changes conflict when they touch the same lines, or both add lines at the same place.
// Changes that only meet (one ends where the other starts) are both applied.
const overlaps = (a, b) =>
  (a.start < b.end && b.start < a.end) || (a.start === a.end && b.start === b.end && a.start === b.start)

// Base lines [start, end) with one side's hunks applied
function apply(lines, hunks, start, end) {
  const result = []
  let at = start
  for (const hunk of hunks) {
    result.push(...lines.slice(at, hunk.start), ...hunk.lines)
    at = hunk.end
  }
  result.push(...lines.slice(at, end))
  return result
}

// Merges `ours` and `theirs`, both made from `base`, into a list of chunks in document order:
// `{ type: "ok", text }`, merged without doubt, and `{ type: "conflict", base, ours, theirs }`,
// the passage as it was and as each side left it. Joining the chunks' texts, with one side
// picked for each conflict, gives the merged document.
export function merge3(base, ours, theirs) {
  const lines = splitLines(base)
  const hunks = [
    ...diffLines(lines, splitLines(ours)).map(hunk => ({ ...hunk, side: "ours" })),
    ...diffLines(lines, splitLines(theirs)).map(hunk => ({ ...hunk, side: "theirs" }))
  ]
    // By position, an insertion before a change at the same line
    .sort((a, b) => a.start - b.start || (a.end - a.start) - (b.end - b.start))

  // Changes that overlap, directly or through others, are decided together. Sorted by start, a
  // change can only overlap the group before it.
  const groups = []
  for (const hunk of hunks) {
    const last = groups.at(-1)
    if (last?.hunks.some(other => overlaps(other, hunk))) {
      last.hunks.push(hunk)
      last.end = Math.max(last.end, hunk.end)
    }
    else
      groups.push({ start: hunk.start, end: hunk.end, hunks: [hunk] })
  }

  const chunks = []
  const push = chunk => {
    const last = chunks.at(-1)
    if (chunk.type === "ok" && last?.type === "ok")
      last.text += chunk.text
    else if (chunk.type === "conflict" || chunk.text)
      chunks.push(chunk)
  }

  let at = 0
  for (const { start, end, hunks: group } of groups) {
    push({ type: "ok", text: lines.slice(at, start).join("") })

    const side = name => apply(lines, group.filter(hunk => hunk.side === name), start, end).join("")
    const [mine, suggested] = [side("ours"), side("theirs")]
    const bothSides = group.some(hunk => hunk.side === "ours") && group.some(hunk => hunk.side === "theirs")

    // Both sides making the same change agree
    if (!bothSides || mine === suggested)
      push({ type: "ok", text: group.every(hunk => hunk.side === "theirs") ? suggested : mine })
    else
      push({ type: "conflict", base: lines.slice(start, end).join(""), ours: mine, theirs: suggested })

    at = end
  }
  push({ type: "ok", text: lines.slice(at).join("") })

  return chunks
}

// The merged text when nothing conflicts, otherwise undefined
export function cleanMerge(base, ours, theirs) {
  const chunks = merge3(base, ours, theirs)
  return chunks.every(chunk => chunk.type === "ok") ? chunks.map(chunk => chunk.text).join("") : undefined
}
