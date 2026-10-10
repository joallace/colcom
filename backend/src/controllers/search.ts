import { RequestHandler } from "express"

import Content from "@/models/content"
import Search from "@/models/search"
import { toFeed } from "@/controllers/content"
import { resolveFilter, splitSlugs } from "@/controllers/tags"
import { validate } from "@/validation"


export const search: RequestHandler = async (req, res) => {
  const author_pid = res.locals.user?.pid

  const { q: query, type, tags: slugs, page, pageSize } = validate("search", req.query)

  // As the topic list: only topics (and their posts) showing all of these tags; none when one doesn't exist
  const tags = slugs ? await resolveFilter(splitSlugs(slugs)) : undefined
  if (tags === null) {
    res.status(200).json({ results: [], count: 0, tags: [] })
    return
  }

  const tagIds = tags?.map(tag => tag.id)
  const hits = await Search.search({ query, type, tagIds, page, pageSize })
  const count = hits[0]?.total_count ?? (page > 1 ? await Search.count({ query, type, tagIds }) : 0)

  // Each hit shown as the profile shows contents, in the order of relevance
  const contents = await Content.findListByIds(hits.map(hit => hit.id), author_pid)
  const byId = new Map((await toFeed(contents, author_pid)).map(content => [content.id, content]))
  const results = hits
    .filter(hit => byId.has(hit.id))
    .map(hit => ({ ...byId.get(hit.id), excerpt: hit.excerpt }))

  // The tags filtered by, named, so the search box shows them as they're written (an alias as its tag)
  res.status(200).json({ results, count, tags: (tags ?? []).map(({ slug, name, provisional }) => ({ slug, name, provisional })) })
}
