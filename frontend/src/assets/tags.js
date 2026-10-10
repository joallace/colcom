import env from "@/assets/enviroment"
import { tagSlug } from "@colcom/shared"

export { tagSlug }

// How many tags a topic shows before the rest collapse into "+N"
export const VISIBLE_TAGS = 5

// Tag pages are /t/<slug>+<slug>…: the topics having all of those tags
export const TAG_SEPARATOR = "+"

export const tagPath = slugs => `/t/${slugs.join(TAG_SEPARATOR)}`

export const tagsFromPath = param => (param ?? "").split(TAG_SEPARATOR).filter(Boolean)

// The tag set with `slug` added, or removed when it's already there
export const toggleTag = (slugs, slug) => slugs.includes(slug) ? slugs.filter(other => other !== slug) : [...slugs, slug]

// The visibility rule, in the words the curation panel shows
export const TAG_RULE = "uma tag aparece enquanto tiver pelo menos tantos apoios quanto contestações."

// Endorses (1), contests (-1) or withdraws (0). Returns { tags } (the topic's, updated) or { error }.
export async function voteOnTag(token, topicId, tag, value) {
  try {
    const res = await fetch(`${env.apiAddress}/topics/${topicId}/tags`, {
      method: "post",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({ tag, value })
    })
    const data = await res.json()

    return res.ok ? { tags: data.tags } : { error: data.message }
  }
  catch (err) {
    console.error(err)
    return { error: "Não foi possível se conectar ao colcom." }
  }
}

// Tags whose slug contains what was typed, for autocomplete
export async function searchTags(query, { pageSize = 6, signal } = {}) {
  const res = await fetch(`${env.apiAddress}/tags?q=${encodeURIComponent(query)}&pageSize=${pageSize}`, { signal })
  if (!res.ok)
    return []
  return (await res.json()).tags
}
