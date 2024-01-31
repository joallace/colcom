import React from "react"
import { useParams, useNavigate } from 'react-router-dom'
import {
  PiBookmarkSimple,
  PiBookmarkSimpleFill,
  PiArrowBendUpLeft
} from "react-icons/pi"

import Topic from "@/components/Topic"
import PostSummary from "@/components/PostSummary"
import env from "@/assets/enviroment"


export default function TopicPage() {
  const [topicData, setTopicData] = React.useState({})
  const [isLoading, setIsLoading] = React.useState(false)
  const navigate = useNavigate()
  const { id } = useParams()

  const headerConfig = {
    "answer": {
      description: "responder tópico",
      icons: PiArrowBendUpLeft,
      onClick: () => navigate("/write", { state: { id, title, config } })
    },
    "bookmark": {
      description: ["salvar tópico", "remover tópico dos salvos"],
      icons: [PiBookmarkSimple, PiBookmarkSimpleFill],
      onStart: () => false,
      onClick: () => { }
    }
  }
  

  const getMetrics = () => {
    const allVotes = topicData.upvotes + topicData.downvotes
    return [
      `promovido por ${topicData.promotions} usuários`,
      allVotes ? `${topicData.upvotes / allVotes}% dos ${allVotes} votantes achou relevante` : "0 votos",
      `${topicData.promotions + allVotes} interações`
    ]
  }

  const NoResponse = () => (
    <div className="no-response">
      ainda não há repostas, que tal contribuir?
    </div>
  )

  React.useEffect(() => {
    const fetchTopic = async () => {
      try {
        setIsLoading(true)
        const url = `${env.apiAddress}/topics/${id}`
        const res = await fetch(url, { method: "get" })
        const data = await res.json()

        if (data) {
          console.log(data)
          setTopicData(data)
        }
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
    <div className="post">
      {isLoading ?
        <div className="spinner" />
        :
        <Topic
          title={topicData.title}
          headerConfig={headerConfig}
          metrics={getMetrics()}
        >
          {topicData.children?.length > 0 ?
            topicData.children.map(child => (
              <PostSummary parent_id={id} id={child.id} shortAnswer={child.title} />
            ))
            :
            <NoResponse />
          }
        </Topic>
      }
    </div>
  )
}