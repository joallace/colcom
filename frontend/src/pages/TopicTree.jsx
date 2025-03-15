import React from "react"
import { useSearchParams } from "react-router-dom"

import NoResponse from "@/components/primitives/NoResponse"
import env from "@/assets/enviroment"
import Topic from "@/components/content/Topic"
import Pagination from "@/components/primitives/Pagination"
import useUser from "@/context/UserContext"


export default function TopicTree({ orderBy, where }) {
  const [searchParams] = useSearchParams();
  const [topics, setTopics] = React.useState([])
  const [page, setPage] = React.useState(searchParams.has("p") ? searchParams.get("p") - 1 : 0)
  const [pageSize, setPageSize] = React.useState(10)
  const [maxIndex, setMaxIndex] = React.useState()
  const [isLoading, setIsLoading] = React.useState(true)
  const { user } = useUser()

  React.useEffect(() => {
    const fetchPromoted = async () => {
      const headers = user ? { "Authorization": `Bearer ${user.accessToken}` } : undefined
      try {
        setIsLoading(true)
        const url = `${env.apiAddress}/topics?page=${page + 1}&pageSize=${pageSize}${where ? `&where=${where}` : ""}${orderBy ? `&orderBy=${orderBy}` : ""}${maxIndex === undefined ? "&with_count" : ""}`
        const res = await fetch(url, { method: "get", headers })
        const data = await res.json()

        if (res.ok) {
          setTopics(data.tree)
          if (maxIndex === undefined)
            setMaxIndex(Math.ceil(data.count / pageSize) - 1)
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
        setIsLoading(false)
      }
    }

    if (user !== undefined)
      fetchPromoted()
  }, [user, page, orderBy])

  React.useEffect(() => {
    const pageQuery = searchParams.get("p")
    setPage(pageQuery ? pageQuery - 1 : 0)
  }, [searchParams])

  React.useEffect(() => {
    document.title = "colcom: colaboração e competição na criação de ideias"
  }, [])

  return (
    <div className={`content tree${topics?.length === 0 ? " centered" : ""}`}>
      {
        isLoading ?
          <div className="spinner" />
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