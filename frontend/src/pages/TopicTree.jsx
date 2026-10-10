import React from "react"

import NoResponse from "@/components/primitives/NoResponse"
import env from "@/assets/enviroment"
import Topic from "@/components/content/Topic"
import Pagination from "@/components/primitives/Pagination"
import Spinner from "@/components/primitives/Spinner"
import useUser from "@/context/UserContext"
import usePageParam from "@/hooks/usePageParam"


const PAGE_SIZE = 10

// `tags` (comma-separated slugs) lists only the topics having all of them; `children` go above the
// list, and `path` is where the pagination links to
export default function TopicTree({ orderBy, where, tags, path = "/promoted", children }) {
  const [topics, setTopics] = React.useState([])
  const [page, setPage] = usePageParam()
  const [maxIndex, setMaxIndex] = React.useState()
  // What the shown topics were fetched for; it's loading until that's what is asked for
  const [loaded, setLoaded] = React.useState({})
  const { user } = useUser()
  const isLoading = loaded.user !== user || loaded.page !== page || loaded.orderBy !== orderBy || loaded.where !== where || loaded.tags !== tags
  // The total is only asked for once; changing pages doesn't change it
  const needsCount = React.useEffectEvent(() => maxIndex === undefined)

  React.useEffect(() => {
    const withCount = needsCount()

    const fetchPromoted = async () => {
      const headers = user ? { "Authorization": `Bearer ${user.accessToken}` } : undefined
      try {
        const url = `${env.apiAddress}/topics?page=${page + 1}&pageSize=${PAGE_SIZE}${where ? `&where=${where}` : ""}${tags ? `&tags=${tags}` : ""}${orderBy ? `&orderBy=${orderBy}` : ""}${withCount ? "&with_count" : ""}`
        const res = await fetch(url, { method: "get", headers })
        const data = await res.json()

        if (res.ok) {
          setTopics(data.tree)
          setMaxIndex(prev => prev ?? Math.ceil(data.count / PAGE_SIZE) - 1)
        }
        else {
          setTopics([])
          setMaxIndex(0)
        }
      }
      catch (err) {
        console.error(err)
      }
      finally {
        setLoaded({ user, page, orderBy, where, tags })
      }
    }

    if (user !== undefined)
      fetchPromoted()
  }, [user, page, orderBy, where, tags])

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