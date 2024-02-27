import React from "react"
import { useParams } from 'react-router-dom'

import env from "@/assets/enviroment"
import { default as Topic } from "@/components/Topic"


export default function TopicPage() {
  const [topicData, setTopicData] = React.useState({})
  const [isLoading, setIsLoading] = React.useState(false)
  const { id } = useParams()


  React.useEffect(() => {
    const fetchTopic = async () => {
      const token = localStorage.getItem("accessToken")
      const headers = token ? { "Authorization": `Bearer ${token}` } : undefined
      try {
        setIsLoading(true)
        const url = `${env.apiAddress}/topics/${id}`
        const res = await fetch(url, { method: "get", headers })
        const data = await res.json()

        if (data)
          setTopicData(data)
      }
      catch (err) {
        console.error(err)
      }
      finally {
        setIsLoading(false)
      }
    }

    fetchTopic()
  }, [])

  return (
    <div className="content tree">
      {isLoading ?
        <div className="spinner" />
        :
        <Topic {...topicData} />
      }
    </div>
  )
}