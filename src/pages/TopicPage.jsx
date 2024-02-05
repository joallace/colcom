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
      onClick: () => navigate("/write", { state: { id, title: topicData.title, config: topicData.config } })
    },
    "bookmark": {
      description: ["salvar tópico", "remover tópico dos salvos"],
      icons: [PiBookmarkSimple, PiBookmarkSimpleFill],
      initialValue: false,
      onClick: () => { }
    }
  }


  const getMetrics = () => {
    const allVotes = topicData.upvotes + topicData.downvotes
    const interactions = topicData.childrenStats?.upvotes + topicData.childrenStats?.downvotes
    return [
      `iniciado por ${topicData.author}`,
      `promovido por ${topicData.promotions} usuário${topicData.promotions === 1 ? "" : "s"}`,
      allVotes ? `${(topicData.upvotes / allVotes) * 100}% dos ${allVotes} votantes achou relevante` : "0 votos",
      `${topicData.childrenStats?.count} post${topicData.childrenStats?.count === 1 ? "" : "s"}`,
      `${interactions} interaç${interactions === 1 ? "ão" : "ões"}`
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
        <Topic
          id={id}
          title={topicData.title}
          headerConfig={headerConfig}
          metrics={getMetrics()}
        >
          {topicData.children?.length > 0 ?
            topicData.children.map(child => (
              <PostSummary
                parent_id={id}
                id={child.id}
                shortAnswer={child.title}
                percentage={((child.upvotes / topicData.childrenStats?.upvotes) * 100) || 0}
              />
            ))
            :
            <NoResponse />
          }
        </Topic>
      }
    </div>
  )
}