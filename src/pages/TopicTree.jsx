import React from "react"
import { useSearchParams } from "react-router-dom"

import NoResponse from "@/components/NoResponse"
import env from "@/assets/enviroment"
import Topic from "@/components/Topic"
import Pagination from "@/components/Pagination"


export default function TopicTree({ orderBy, where }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [topics, setTopics] = React.useState([])
  const [page, setPage] = React.useState(searchParams.get("p") ? searchParams.get("p") - 1 : 0)
  const [pageSize, setPageSize] = React.useState(10)
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    const fetchPromoted = async () => {
      const token = localStorage.getItem("accessToken")
      const headers = token ? { "Authorization": `Bearer ${token}` } : undefined
      try {
        setIsLoading(true)
        const url = `${env.apiAddress}/topics?${where ? `$where=${where}&` : ""}page=${page + 1}&pageSize=${pageSize}&${orderBy ? `$orderBy=${orderBy}&` : ""}type=topic`
        const res = await fetch(url, { method: "get", headers })
        const data = await res.json()

        if (Array.isArray(data))
          setTopics(data)
        else
          setTopics([])
      }
      catch (err) {
        console.error(err)
      }
      finally {
        setIsLoading(false)
      }
    }

    fetchPromoted()
  }, [page])

  React.useEffect(() => {
    const pageQuery = searchParams.get("p")
    console.log(pageQuery)

    setPage(pageQuery ? pageQuery - 1 : 0)
  }, [searchParams])

  return (
    <div className="content tree">
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
      />
    </div>
  )
}