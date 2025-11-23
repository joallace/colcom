import React from "react"
import { useParams } from 'react-router-dom'

import env from "@/assets/enviroment"
import Topic from "@/components/content/Topic"
import Spinner from "@/components/primitives/Spinner"
import useUser from "@/context/UserContext"


export default function TopicPage() {
  const [topicData, setTopicData] = React.useState({})
  const [isLoading, setIsLoading] = React.useState(true)
  const { user } = useUser()
  const { id } = useParams()


  React.useEffect(() => {
    const fetchTopic = async () => {
      const headers = user ? { "Authorization": `Bearer ${user.accessToken}` } : undefined
      try {
        setIsLoading(true)
        const url = `${env.apiAddress}/topics/${id}`
        const res = await fetch(url, { method: "get", headers })
        const data = await res.json()

        if (data) {
          setTopicData(data)
          document.title = `${data.title} · colcom`
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
      fetchTopic()
  }, [user])

  return (
    <div className={`content ${isLoading ? "centered" : "tree"}`}>
      {isLoading ?
        <Spinner />
        :
        <Topic {...topicData} />
      }
    </div>
  )
}