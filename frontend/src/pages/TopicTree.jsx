import React from "react"

import NoResponse from "@/components/primitives/NoResponse"
import env from "@/assets/enviroment"
import Topic from "@/components/content/Topic"
import Pagination from "@/components/primitives/Pagination"
import Spinner from "@/components/primitives/Spinner"
import useUser from "@/context/UserContext"
import usePageParam from "@/hooks/usePageParam"


const PAGE_SIZE = 10

export default function TopicTree({ orderBy, where }) {
  const [topics, setTopics] = React.useState([])
  const [page, setPage] = usePageParam()
  const [maxIndex, setMaxIndex] = React.useState()
  // What the shown topics were fetched for; it's loading until that's what is asked for
  const [loaded, setLoaded] = React.useState({})
  const { user } = useUser()
  const isLoading = loaded.user !== user || loaded.page !== page || loaded.orderBy !== orderBy || loaded.where !== where
  // The total is only asked for once; changing pages doesn't change it
  const needsCount = React.useEffectEvent(() => maxIndex === undefined)

  React.useEffect(() => {
    const withCount = needsCount()

    const fetchPromoted = async () => {
      const headers = user ? { "Authorization": `Bearer ${user.accessToken}` } : undefined
      try {
        const url = `${env.apiAddress}/topics?page=${page + 1}&pageSize=${PAGE_SIZE}${where ? `&where=${where}` : ""}${orderBy ? `&orderBy=${orderBy}` : ""}${withCount ? "&with_count" : ""}`
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
        setLoaded({ user, page, orderBy, where })
      }
    }

    if (user !== undefined)
      fetchPromoted()
  }, [user, page, orderBy, where])

  React.useEffect(() => {
    document.title = "colcom: colaboração e competição na criação de ideias"
  }, [])

  return (
    <div className={`content ${(isLoading || topics?.length === 0) ? "centered" : "tree"}`}>
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
        path="/promoted"
        state={[page, setPage]}
        isLoading={isLoading}
        maxIndex={maxIndex}
      />
    </div>
  )
}