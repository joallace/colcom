import { getSchema } from "@tiptap/core"
import { DOMParser as SchemaParser } from "@tiptap/pm/model"
import search from "approx-string-match"
import getExtensions from "@/components/Editor/extensions"
import textIndex from "@/assets/textIndex"
import { diff, diffWords } from "@/assets/textDiff"


// Critiques are anchored like W3C Web Annotations: the version they were made on (commit + ProseMirror
// positions) plus the quoted text and some context around it. On that version the positions are used
// as they are. On a later version the passage is followed through every edit since, version by version
// and the passage is carried through the edits, which stays exact even in repetitive text. Without the
// original text, the quote is searched for instead.

const CONTEXT_LENGTH = 32
const CONTEXT_MIN_LENGTH = 8
// Below this length an approximate match is too likely to land on unrelated text
const FUZZY_MIN_LENGTH = 12
const FUZZY_MAX_ERROR_RATE = 0.25
// Next to an intact prefix or suffix the passage's place is known, so a bigger edit can be accepted
const ANCHORED_MAX_ERROR_RATE = 0.5

let schema

export function docFromHtml(html) {
  schema ??= getSchema(getExtensions())

  // A document made by DOMParser is inert: unlike an element's innerHTML, it runs no event handlers
  // (e.g. <img onerror>) from the user written HTML being parsed
  const dom = new window.DOMParser().parseFromString(html ?? "", "text/html")
  return SchemaParser.fromSchema(schema).parse(dom.body)
}

const commonPrefixLength = (a, b) => {
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  return i
}

const commonSuffixLength = (a, b) => {
  let i = 0
  while (i < a.length && i < b.length && a[a.length - 1 - i] === b[b.length - 1 - i]) i++
  return i
}

// The quote a new critique stores for the selection [from, to) of the version being read.
// Returns null when the selection holds no text (e.g. an empty paragraph), which can't be quoted.
// A chart is quoted as its stand-in character (textIndex's CHART_TEXT).
export function quoteFromRange(doc, from, to) {
  const { text, positions } = textIndex(doc)
  const inRange = p => p !== null && p >= from && p < to

  const start = positions.findIndex(inRange)
  if (start === -1)
    return null

  let end = positions.length
  while (!inRange(positions[end - 1])) end--

  return {
    exact: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
    suffix: text.slice(end, end + CONTEXT_LENGTH),
    start
  }
}

function toRange({ positions }, start, end) {
  // Matches may begin or end on a block separator, which has no position of its own
  while (start < end && positions[start] === null) start++
  while (end > start && positions[end - 1] === null) end--

  return start < end ? { from: positions[start], to: positions[end - 1] + 1 } : null
}

const indexesOf = (text, str) => {
  const found = []
  for (let i = text.indexOf(str); i !== -1; i = text.indexOf(str, i + 1))
    found.push(i)
  return found
}

function findBetweenContext(index, { exact, prefix, suffix }, distance) {
  const { text } = index

  // A short context is too common to locate anything; an empty one means the start or end of the text
  if (Math.max(prefix.length, suffix.length) < CONTEXT_MIN_LENGTH)
    return null

  const starts = prefix ? indexesOf(text, prefix).map(i => i + prefix.length) : [0]
  let best = null

  for (const start of starts) {
    const end = suffix ? text.indexOf(suffix, start) : text.length
    const length = end - start

    // The edited passage may grow or shrink, but not beyond recognition
    if (end === -1 || length <= 0 || length > exact.length * 2 + CONTEXT_LENGTH)
      continue

    if (!best || distance(start) < distance(best.start))
      best = { start, end }
  }

  return best && toRange(index, best.start, best.end)
}

// Only one side of the context survived (e.g. the next paragraph was deleted). It still pins where
// the passage starts or ends, so a looser approximate match right next to it is safe.
function findNextToContext(index, { exact, prefix, suffix }, distance) {
  if (exact.length < FUZZY_MIN_LENGTH)
    return null

  const { text } = index
  const windowLength = exact.length * 2 + CONTEXT_LENGTH
  const maxErrors = Math.floor(exact.length * ANCHORED_MAX_ERROR_RATE)
  const candidates = []

  if (prefix.length >= CONTEXT_MIN_LENGTH)
    for (const i of indexesOf(text, prefix)) {
      const windowStart = i + prefix.length

      for (const match of search(text.slice(windowStart, windowStart + windowLength), exact, maxErrors))
        if (match.start <= CONTEXT_LENGTH)
          candidates.push({ ...match, start: windowStart + match.start, end: windowStart + match.end })
    }

  if (suffix.length >= CONTEXT_MIN_LENGTH)
    for (const i of indexesOf(text, suffix)) {
      const windowStart = Math.max(0, i - windowLength)

      for (const match of search(text.slice(windowStart, i), exact, maxErrors))
        if (i - (windowStart + match.end) <= CONTEXT_LENGTH)
          candidates.push({ ...match, start: windowStart + match.start, end: windowStart + match.end })
    }

  const [best] = candidates.sort((a, b) => a.errors - b.errors || distance(a.start) - distance(b.start))
  return best ? toRange(index, best.start, best.end) : null
}

function findQuote(index, { exact, prefix, suffix, start }) {
  const { text } = index
  const distance = i => Math.abs(i - start) / Math.max(text.length, 1)

  // The passage is unchanged when its exact text is still there. With several occurrences, the one
  // whose surrounding text agrees most with the stored context wins, then the one nearest its old place.
  let best = null
  for (const i of indexesOf(text, exact)) {
    const context = commonSuffixLength(text.slice(Math.max(0, i - prefix.length), i), prefix)
      + commonPrefixLength(text.slice(i + exact.length, i + exact.length + suffix.length), suffix)
    const score = context - distance(i)

    if (!best || score > best.score)
      best = { start: i, end: i + exact.length, score }
  }

  if (best)
    return { ...toRange(index, best.start, best.end), match: "exact" }

  // Otherwise the passage may have been edited. When the text around it is intact, the passage is
  // whatever now sits between its prefix and suffix, however much its own words changed.
  const nearby = findBetweenContext(index, { exact, prefix, suffix }, distance)
    ?? findNextToContext(index, { exact, prefix, suffix }, distance)
  if (nearby)
    return { ...nearby, match: "fuzzy" }

  // Last resort, for when its surroundings changed too: the closest approximate match of the quote
  if (exact.length >= FUZZY_MIN_LENGTH) {
    const maxErrors = Math.floor(exact.length * FUZZY_MAX_ERROR_RATE)
    const [closest] = search(text, exact, maxErrors)
      .sort((a, b) => a.errors - b.errors || distance(a.start) - distance(b.start))

    const range = closest && toRange(index, closest.start, closest.end)
    if (range)
      return { ...range, match: "fuzzy" }
  }

  return { match: "removed" }
}

// Carries the old text's range [start, end) through the edits that turned it into the new text.
// Words inserted inside the passage join it, those inserted right before or after it don't.
function mapThroughDiff(edits, start, end) {
  let oldPos = 0, newPos = 0, newStart = null, newEnd = null, kept = 0

  for (const [operation, text] of edits) {
    const length = text.length

    if (operation === diff.INSERT) {
      newPos += length
      continue
    }

    // Equal and deleted text both consume the old text; only equal text survives into the new one
    const isEqual = operation === diff.EQUAL
    if (newStart === null && start < oldPos + length)
      newStart = newPos + (isEqual ? Math.max(0, start - oldPos) : 0)
    if (newEnd === null && end <= oldPos + length)
      newEnd = newPos + (isEqual ? Math.max(0, end - oldPos) : 0)
    if (isEqual)
      kept += Math.max(0, Math.min(end, oldPos + length) - Math.max(start, oldPos))

    oldPos += length
    if (isEqual)
      newPos += length
  }

  return { start: newStart ?? newPos, end: newEnd ?? newPos, kept }
}

// How much of a passage must survive a single edit for it to be the same passage, edited. Below it the
// passage was removed (or rewritten beyond recognition), even if a few of its words remain.
const MIN_KEPT_RATIO = 0.5

// In repetitive text a diff can't tell which of two identical stretches an edit touched: deleting a
// copy right after the passage reads the same as cutting the passage's end and keeping that copy.
// So when the quote is still there word for word, overlapping the followed range or at most as far
// from it as the edit took from the passage (`lost`), the passage is that occurrence.
function snapToQuote({ text }, exact, start, end, lost) {
  let best = null

  for (const at of indexesOf(text, exact)) {
    const overlap = Math.min(end, at + exact.length) - Math.max(start, at)
    if ((overlap > 0 || -overlap <= lost) && (!best || overlap > best.overlap))
      best = { start: at, end: at + exact.length, overlap }
  }

  return best ?? { start, end }
}

// Follows the passage [start, end) of the first index through each of `steps`' edits (word by word),
// version by version. Once an edit removes it, it stays removed, whatever text a later version adds.
function followThroughEdits(steps, exact, start, end) {
  for (const { edits, newIndex } of steps) {
    const mapped = mapThroughDiff(edits, start, end)

    if (mapped.kept < (end - start) * MIN_KEPT_RATIO || !toRange(newIndex, mapped.start, mapped.end))
      return null

    ;({ start, end } = snapToQuote(newIndex, exact, mapped.start, mapped.end, end - start - mapped.kept))
  }
  return { start, end }
}

function findThroughHistory(index, oldIndex, steps, { exact, start }) {
  // The stored offsets must still describe the quote in the original text, or they can't be trusted
  if (oldIndex.text.slice(start, start + exact.length) !== exact)
    return null

  const followed = followThroughEdits(steps, exact, start, start + exact.length)
  if (!followed)
    return { match: "removed" }

  const unchanged = index.text.slice(followed.start, followed.end) === exact
  return { ...toRange(index, followed.start, followed.end), match: unchanged ? "exact" : "fuzzy" }
}

// Adds to each critique an `anchor` saying where it lands on the version being read (`commit`, whose
// text is `html`): { from, to, match: "exact" | "fuzzy" } or { match: "removed" }. The backend only
// sends critiques made on this version or on earlier ones, plus `lineages`: for each earlier version
// they were made on, the versions from it to this one, and `versions`: the text of those versions.
export function projectCritiques(html, critiques, commit, versions = {}, lineages = {}) {
  const indexes = new Map()
  const edits = new Map()

  const indexOf = version => {
    if (!indexes.has(version))
      indexes.set(version, textIndex(docFromHtml(version === commit ? html : versions[version])))
    return indexes.get(version)
  }

  // The edits from one version to the next, shared by every critique whose lineage passes there
  const editsBetween = (from, to) => {
    const key = `${from}..${to}`
    if (!edits.has(key))
      edits.set(key, diffWords(indexOf(from).text, indexOf(to).text))
    return edits.get(key)
  }

  return critiques.map(critique => {
    const { config } = critique

    if (config?.commit === commit)
      return { ...critique, anchor: { from: config.from, to: config.to, match: "exact" } }

    if (!config?.quote)
      return { ...critique, anchor: { match: "removed" } }

    const lineage = lineages[config.commit]
    const isComplete = lineage?.at(-1) === commit && lineage.slice(0, -1).every(version => versions[version] !== undefined)

    if (isComplete) {
      const steps = lineage.slice(1).map((version, i) => ({ edits: editsBetween(lineage[i], version), newIndex: indexOf(version) }))
      const anchor = findThroughHistory(indexOf(commit), indexOf(config.commit), steps, config.quote)
      if (anchor)
        return { ...critique, anchor }
    }

    // Without the versions in between, the quote is searched for instead
    return { ...critique, anchor: findQuote(indexOf(commit), config.quote) }
  })
}
