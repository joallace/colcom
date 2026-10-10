import { merge3, splitLines } from "@colcom/shared"


// A suggestion's conflicts with its post (GET /contents/:id/:hash/merge): the post as it is is
// "ours", the suggestion "theirs", both changed from the version it was made on. Whatever only one
// of them changed, or both changed the same way, is already merged (merge3, in shared/).
export const mergeChunks = ({ base, head, suggestion }) => merge3(base.body, head.body, suggestion.body)

export const conflictsOf = chunks => chunks.filter(chunk => chunk.type === "conflict")

// What each choice keeps of a conflict; "both" puts the author's version first
export const CHOICES = {
  ours: chunk => chunk.ours,
  theirs: chunk => chunk.theirs,
  both: chunk => chunk.ours + chunk.theirs
}

// The merged document, with `choices[i]` ("ours", "theirs" or "both") taken for the i-th conflict
export function resolveChunks(chunks, choices) {
  let conflict = 0
  return chunks.map(chunk => chunk.type === "ok" ? chunk.text : CHOICES[choices[conflict++]](chunk)).join("")
}

// A block's text, to show around a conflict where it is. Parsed, never rendered (see AGENTS.md).
const blockText = line => new DOMParser().parseFromString(line, "text/html").body.textContent.trim()

// The blocks just before and after each conflict, as plain text ("" at either end of the document)
export function conflictContexts(chunks) {
  const nearest = (chunk, fromEnd) => {
    if (chunk?.type !== "ok")
      return ""
    const lines = splitLines(chunk.text)
    if (fromEnd)
      lines.reverse()
    return lines.map(blockText).find(Boolean) ?? ""
  }

  return chunks
    .map((chunk, i) => chunk.type === "conflict" ? { before: nearest(chunks[i - 1], true), after: nearest(chunks[i + 1], false) } : undefined)
    .filter(Boolean)
}
