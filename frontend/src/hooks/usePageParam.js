import React from "react"
import { useSearchParams } from "react-router"

const pageFrom = query => query ? query - 1 : 0

// The page index from the URL's `p` (which counts from 1). It's state rather than derived because
// Pagination also sets it without navigating (typing a page number); a new `p` overrides it.
export default function usePageParam() {
  const [searchParams] = useSearchParams()
  const query = searchParams.get("p")
  const [page, setPage] = React.useState(() => pageFrom(query))
  const [lastQuery, setLastQuery] = React.useState(query)

  if (query !== lastQuery) {
    setLastQuery(query)
    setPage(pageFrom(query))
  }

  return [page, setPage]
}
