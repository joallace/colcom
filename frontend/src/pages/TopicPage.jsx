import React from "react"
import { Link, useParams } from 'react-router'

import Topic from "@/components/content/Topic"
import NoResponse from "@/components/primitives/NoResponse"
import Spinner from "@/components/primitives/Spinner"
import useUser from "@/context/UserContext"
import useApiResource from "@/hooks/useApiResource"


export default function TopicPage() {
  const { user } = useUser()
  const { id } = useParams()
  const { data, error, isLoading } = useApiResource(user !== undefined ? `/topics/${id}` : null, { deps: [user, id] })

  React.useEffect(() => {
    if (data)
      document.title = `${data.title} · colcom`
    else if (error)
      document.title = "tópico não encontrado · colcom"
  }, [data, error])

  return (
    <div className={`content ${isLoading || error ? "centered" : "tree"}`}>
      {isLoading ?
        <Spinner />
        :
        error ?
          <NoResponse>
            {error.status === 404 ? "tópico não encontrado." : "não foi possível carregar o tópico."}
            {" "}<Link to="/">ver os tópicos</Link>
          </NoResponse>
          :
          <Topic {...data} showBody />
      }
    </div>
  )
}