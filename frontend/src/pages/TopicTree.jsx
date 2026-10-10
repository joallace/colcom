import React from "react"

import NoResponse from "@/components/primitives/NoResponse"
import Topic from "@/components/content/Topic"
import Pagination from "@/components/primitives/Pagination"
import Spinner from "@/components/primitives/Spinner"
import useUser from "@/context/UserContext"
import useApiResource from "@/hooks/useApiResource"
import usePageParam from "@/hooks/usePageParam"


const PAGE_SIZE = 10

// `tags` (comma-separated slugs) lists only the topics having all of them; `children` go above the
// list, and `path` is where the pagination links to
export default function TopicTree({ orderBy, where, tags, path = "/promoted", children }) {
  const [page, setPage] = usePageParam()
  const [maxIndex, setMaxIndex] = React.useState()
  const { user } = useUser()
  // The total is only asked for once: it's left out of the deps, so its arrival fetches nothing
  const query = `page=${page + 1}&pageSize=${PAGE_SIZE}${where ? `&where=${where}` : ""}${tags ? `&tags=${tags}` : ""}${orderBy ? `&orderBy=${orderBy}` : ""}${maxIndex === undefined ? "&with_count" : ""}`
  const { data, error, isLoading } = useApiResource(user !== undefined ? `/topics?${query}` : null, { deps: [user, page, orderBy, where, tags] })
  const topics = data?.tree ?? []

  // Changing pages doesn't change the total; a failure leaves a single page
  if (maxIndex === undefined && data)
    setMaxIndex(Math.ceil(data.count / PAGE_SIZE) - 1)
  else if (error && maxIndex !== 0)
    setMaxIndex(0)

  React.useEffect(() => {
    // A tag page names itself
    if (!tags)
      document.title = "colcom: colaboração e competição na criação de ideias"
  }, [tags])

  return (
    <div className={`content ${(isLoading || topics?.length === 0) ? "centered" : "tree"}`}>
      {children}
      {
        isLoading ?
          <Spinner />
          :
          topics.length > 0 ?
            topics.map(topic => (
              <Topic {...topic} key={`t${topic.id}`} />
            ))
            :
            <NoResponse />
      }
      <Pagination
        path={path}
        state={[page, setPage]}
        isLoading={isLoading}
        maxIndex={maxIndex}
      />
    </div>
  )
}