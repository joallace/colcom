// Full-text search (GET /search): its address and the excerpts it sends

// What each result is filtered to: the key is the URL's `type`, absent for everything
export const SEARCH_TYPES = [
  { type: undefined, label: "tudo" },
  { type: "topic", label: "tópicos" },
  { type: "post", label: "posts" }
]

// The API marks the matched words of an excerpt with these private-use characters (models/search.ts)
const MATCH_START = ""
const MATCH_END = ""

// The search page's address; the first page has no `p`
export function searchPath({ q, type, page = 0 } = {}) {
  const params = new URLSearchParams()
  if (q)
    params.set("q", q)
  if (type)
    params.set("type", type)
  if (page > 0)
    params.set("p", String(page + 1))

  const query = params.toString()
  return query ? `/search?${query}` : "/search"
}

// An excerpt as pieces of text, each matched or not, to draw without parsing HTML
export function excerptParts(excerpt) {
  const parts = []

  for (const [index, piece] of (excerpt ?? "").split(MATCH_START).entries()) {
    const [matched, rest] = index === 0 ? [undefined, piece] : piece.split(MATCH_END)
    if (matched)
      parts.push({ text: matched, match: true })
    if (rest)
      parts.push({ text: rest, match: false })
  }

  return parts
}

// Whether the text itself matched; when only the title or tags did, the excerpt is just its start
export const hasMatch = excerpt => Boolean(excerpt?.includes(MATCH_START))
