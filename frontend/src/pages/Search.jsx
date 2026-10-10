import React from "react"
import { Link, useSearchParams } from "react-router"

import NoResponse from "@/components/primitives/NoResponse"
import Spinner from "@/components/primitives/Spinner"
import Pagination from "@/components/primitives/Pagination"
import ContentList from "@/components/content/ContentList"
import SearchBox from "@/components/layout/SearchBox"
import useApiResource from "@/hooks/useApiResource"
import usePageParam from "@/hooks/usePageParam"
import { SEARCH_TYPES, searchPath, tagsFromSearch } from "@/assets/search"


const PAGE_SIZE = 10

// /search?q=…&tags=a,b&type=topic|post: topics and posts whose title or text match `q`, most
// relevant first, among those of the topics having all of `tags` (typed as "#tag" in the field)
export default function Search() {
  const [params] = useSearchParams()
  const [page, setPage] = usePageParam()
  const q = (params.get("q") ?? "").trim()
  const tags = tagsFromSearch(params.get("tags"))
  const type = SEARCH_TYPES.find(option => option.type === params.get("type"))?.type
  const searched = q !== "" || tags.length > 0
  // What's searched, whatever the page: a new search asks for its total again
  const searchKey = searchPath({ q, type, tags })

  const query = new URLSearchParams({ ...(q && { q }), ...(tags.length > 0 && { tags: tags.join(",") }), ...(type && { type }), page: page + 1, pageSize: PAGE_SIZE })
  const { data, error, isLoading } = useApiResource(searched ? `/search?${query}` : null)
  const results = data?.results ?? []

  // Changing pages doesn't change the total; a failure leaves a single page
  const [total, setTotal] = React.useState({ key: null, maxIndex: undefined })
  if (data && total.key !== searchKey)
    setTotal({ key: searchKey, maxIndex: Math.ceil(data.count / PAGE_SIZE) - 1 })
  else if (error && (total.key !== searchKey || total.maxIndex !== 0))
    setTotal({ key: searchKey, maxIndex: 0 })

  // The tags as they're written, once the API named them; their slugs until then
  const named = new Map((data?.tags ?? []).map(tag => [tag.slug, tag.name]))
  const label = [q, ...tags.map(slug => `#${named.get(slug) ?? slug}`)].filter(Boolean).join(" ")

  React.useEffect(() => {
    document.title = label ? `${label} · busca · colcom` : "busca · colcom"
  }, [label])

  return (
    <div className="content tree">
      <header className="searchHeader">
        {/* Remounted for each search, so going back shows that search in the field */}
        <SearchBox
          key={searchKey}
          initialQuery={q}
          initialTags={tags.map(slug => ({ slug }))}
          tagNames={named}
          type={type}
          autoFocus={!searched}
        />
        <div className="searchTypes" role="group" aria-label="mostrar">
          {SEARCH_TYPES.map(option => (
            <Link
              key={option.label}
              to={searchPath({ q, tags, type: option.type })}
              className={option.type === type ? "active" : undefined}
              aria-current={option.type === type ? "page" : undefined}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </header>
      {!searched ?
        <NoResponse>busque por título ou trecho do texto, e use # para buscar por tags.</NoResponse>
        :
        isLoading ?
          <Spinner />
          :
          error ?
            <NoResponse>{error.status === 400 ? error.message : "não foi possível se conectar ao colcom."}</NoResponse>
            :
            results.length > 0 ?
              <>
                <p className="searchCount" role="status">
                  {data.count} resultado{data.count === 1 ? "" : "s"} para <strong>{label}</strong>
                </p>
                <ContentList contents={results} />
              </>
              :
              <NoResponse>nada encontrado para “{label}”... tente outras palavras ou tags.</NoResponse>
      }
      {searched &&
        <Pagination
          path={searchKey}
          state={[page, setPage]}
          isLoading={isLoading}
          maxIndex={total.key === searchKey ? total.maxIndex : undefined}
        />
      }
    </div>
  )
}
