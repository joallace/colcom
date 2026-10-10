// Full-text search (GET /search): its address, what's typed in the search box and the excerpts it sends

import { tagSlug } from "@colcom/shared"

// What each result is filtered to: the key is the URL's `type`, absent for everything
export const SEARCH_TYPES = [
  { type: undefined, label: "tudo" },
  { type: "topic", label: "tópicos" },
  { type: "post", label: "posts" }
]

// The API marks the matched words of an excerpt with these private-use characters (models/search.ts)
const MATCH_START = ""
const MATCH_END = ""

// The search page's address, `tags` a list of slugs; the first page has no `p`
export function searchPath({ q, type, tags = [], page = 0 } = {}) {
  const params = new URLSearchParams()
  if (q)
    params.set("q", q)
  if (tags.length > 0)
    params.set("tags", tags.join(","))
  if (type)
    params.set("type", type)
  if (page > 0)
    params.set("p", String(page + 1))

  const query = params.toString()
  return query ? `/search?${query}` : "/search"
}

// The search page's tags, from its address (slugs, as /t takes them)
export const tagsFromSearch = param => (param ?? "").split(",").filter(Boolean)

// The "#word" the caret is in or right after, which the search box suggests tags for: where it
// starts and ends in `text`, and what follows the "#". Null when the caret isn't in one.
export function hashtagAt(text, caret) {
  const start = text.slice(0, caret).search(/\S*$/)
  if (text[start] !== "#")
    return null

  const end = caret + text.slice(caret).search(/\s|$/)
  return { start, end, query: text.slice(start + 1, end) }
}

// What's typed in the search box: words, searched in titles and texts, and "#tag"s, only searched as
// tags. A "#" alone is dropped.
export function splitQuery(text) {
  const words = []
  const tags = []

  for (const token of text.split(/\s+/).filter(Boolean)) {
    if (token[0] !== "#")
      words.push(token)
    else if (tagSlug(token.slice(1)) && !tags.includes(tagSlug(token.slice(1))))
      tags.push(tagSlug(token.slice(1)))
  }

  return { q: words.join(" "), tags }
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
