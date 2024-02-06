import React from "react"

import NoResponse from "@/components/NoResponse"
import env from "@/assets/enviroment"
import Topic from "@/components/Topic"


export default function Promoted() {
  const [topics, setTopics] = React.useState([])
  const [page, setPage] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(10)
  const [isLoading, setIsLoading] = React.useState(false)

  React.useEffect(() => {
    const fetchPromoted = async () => {
      const token = localStorage.getItem("accessToken")
      const headers = token ? { "Authorization": `Bearer ${token}` } : undefined
      try {
        setIsLoading(true)
        const url = `${env.apiAddress}/topics?page=${page + 1}&pageSize=${pageSize}&type=topic`
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
  }, [])

  return (
    <div className="content tree">
      {
        isLoading ?
          <div className="spinner" />
          :
          topics.length > 0 ?
            topics.map(topic => (
              <Topic {...topic}/>
            ))
            :
            <NoResponse />
      }
    </div>
  )
}