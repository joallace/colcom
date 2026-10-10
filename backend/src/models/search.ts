import db from "@/pgDatabase"
import { limitOffset } from "@/pagination"
import { tagFilterSql } from "@/models/tags"
import { queryParams } from "@/models/sql"


export type SearchType = "topic" | "post"

// Where an excerpt's matched words start and end. Private-use characters, which plainText removes
// from the indexed text, so the excerpt is plain text the client marks up without parsing HTML.
export const MATCH_START = ""
export const MATCH_END = ""

const HEADLINE_OPTIONS = `StartSel=${MATCH_START}, StopSel=${MATCH_END}, MaxFragments=2, MaxWords=24, MinWords=10, FragmentDelimiter=" … "`

export interface SearchHit {
  id: number,
  excerpt: string,
  total_count: number
}

interface SearchOptions {
  // As people type it: words, "a phrase", or, -excluded (websearch_to_tsquery)
  query: string,
  // Topics and posts when omitted
  type?: SearchType,
  // Only topics showing all of these tags, and those topics' posts
  tagIds?: number[],
  page?: number,
  pageSize?: number
}

// A page of the topics and posts matching `query`, most relevant first: a match in the title weighs
// most, then one in the tags (a post's are its topic's), then one in the text. Each comes with an
// excerpt of its text around the matched words, and total_count, how many match across all pages.
async function search({ query, type, tagIds, page = 1, pageSize = 10 }: SearchOptions): Promise<SearchHit[]> {
  const params = queryParams()
  const tsquery = `websearch_to_tsquery('colcom', ${params.add(query, "TEXT")})`
  const types = params.add(type ? [type] : ["topic", "post"], "TEXT[]")
  const tags = tagIds ? tagFilterSql("CASE WHEN contents.type = 'topic' THEN contents.id ELSE contents.parent_id END", params.add(tagIds)) : "TRUE"

  const result = await db.query({
    text: `
      WITH matches AS (
        SELECT
          contents.id,
          -- Normalised by the text's length, so a long post doesn't win by repeating a word
          ts_rank(contents.search, ${tsquery}, 1) AS rank,
          COUNT(*) OVER ()::INT AS total_count
        FROM
          contents
        WHERE
          contents.search @@ ${tsquery}
        AND
          contents.type = ANY(${types})
        AND
          ${tags}
        ORDER BY
          rank DESC, contents.id DESC
        ${limitOffset(page, pageSize)}
      )
      -- Excerpts only for this page: ts_headline parses the whole text again
      SELECT
        matches.id,
        matches.total_count,
        ts_headline('colcom', COALESCE(contents.search_text, ''), ${tsquery}, '${HEADLINE_OPTIONS}') AS excerpt
      FROM
        matches
      INNER JOIN
        contents ON contents.id = matches.id
      ORDER BY
        matches.rank DESC, matches.id DESC
      ;`,
    values: params.values
  })
  return result.rows
}

async function count({ query, type, tagIds }: Omit<SearchOptions, "page" | "pageSize">): Promise<number> {
  const [hit] = await search({ query, type, tagIds, page: 1, pageSize: 1 })
  return hit?.total_count ?? 0
}

// Contents written before search existed, whose text isn't indexed yet
async function unindexed(limit: number): Promise<{ id: number, parent_id: number | null, type: string, body: string | null }[]> {
  const result = await db.query({
    text: "SELECT id, parent_id, type, body FROM contents WHERE search_text IS NULL ORDER BY id LIMIT $1;",
    values: [limit]
  })
  return result.rows
}

async function index(id: number, text: string) {
  await db.query({
    text: `
      UPDATE contents SET
        search_text = $2,
        tag_names = topic_tag_names(CASE WHEN type = 'topic' THEN id WHEN type = 'post' THEN parent_id END)
      -- An edit meanwhile already indexed the newer text
      WHERE id = $1 AND search_text IS NULL
      ;`,
    values: [id, text]
  })
}

export default Object.freeze({
  search,
  count,
  unindexed,
  index
})
