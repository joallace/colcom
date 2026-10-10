import React from "react"
import { Link, useSearchParams } from "react-router"

import NoResponse from "@/components/primitives/NoResponse"
import Spinner from "@/components/primitives/Spinner"
import Pagination from "@/components/primitives/Pagination"
import ContentList from "@/components/content/ContentList"
import SearchBox from "@/components/layout/SearchBox"
import useApiResource from "@/hooks/useApiResource"
import usePageParam from "@/hooks/usePageParam"
import { SEARCH_TYPES, searchPath } from "@/assets/search"


const PAGE_SIZE = 10

// /search?q=…&type=topic|post: topics and posts whose title, tags or text match, most relevant first
export default function Search() {
  const [params] = useSearchParams()
  const q = (params.get("q") ?? "").trim()
  const type = SEARCH_TYPES.find(option => option.type === params.get("type"))?.type

  React.useEffect(() => {
    document.title = q ? `${q} · busca · colcom` : "busca · colcom"
  }, [q])

  return (
    <div className="content tree">
      <header className="searchHeader">
        {/* Remounted for each query, so going back shows that query in the field */}
        <SearchBox key={q} initialQuery={q} type={type} autoFocus={!q} />
        <div className="searchTypes" role="group" aria-label="mostrar">
          {SEARCH_TYPES.map(option => (
            <Link
              key={option.label}
              to={searchPath({ q, type: option.type })}
              className={option.type === type ? "active" : undefined}
              aria-current={option.type === type ? "page" : undefined}
            >
              {option.label}
            </Link>
          ))}
        </div>
      </header>
      {q ?
        // Remounted for each search, so its page count is asked for again
        <SearchResults key={`${type}:${q}`} q={q} type={type} />
        :
        <NoResponse>busque por título, tag ou trecho do texto.</NoResponse>
      }
    </div>
  )
}

function SearchResults({ q, type }) {
  const [page, setPage] = usePageParam()
  const [maxIndex, setMaxIndex] = React.useState()
  const { data, error, isLoading } = useApiResource(`/search?${new URLSearchParams({ q, ...(type && { type }), page: page + 1, pageSize: PAGE_SIZE })}`)
  const results = data?.results ?? []

  // Changing pages doesn't change the total; a failure leaves a single page
  if (maxIndex === undefined && data)
    setMaxIndex(Math.ceil(data.count / PAGE_SIZE) - 1)
  else if (error && maxIndex !== 0)
    setMaxIndex(0)

  return (
    <>
      {isLoading ?
        <Spinner />
        :
        error ?
          <NoResponse>{error.status === 400 ? error.message : "não foi possível se conectar ao colcom."}</NoResponse>
          :
          results.length > 0 ?
            <>
              <p className="searchCount" role="status">
                {data.count} resultado{data.count === 1 ? "" : "s"} para <strong>{q}</strong>
              </p>
              <ContentList contents={results} />
            </>
            :
            <NoResponse>nada encontrado para “{q}”... tente outras palavras.</NoResponse>
      }
      <Pagination
        path={searchPath({ q, type })}
        state={[page, setPage]}
        isLoading={isLoading}
        maxIndex={maxIndex}
      />
    </>
  )
}
