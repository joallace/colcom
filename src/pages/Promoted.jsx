import React from "react"
import {
  PiBookmarkSimple,
  PiBookmarkSimpleFill,
  PiArrowBendUpLeft
} from "react-icons/pi"
import { Link, useNavigate } from "react-router-dom"

import Topic from "@/components/Topic"
import PostSummary from "@/components/PostSummary"
import env from "@/assets/enviroment"


export default function Promoted() {
  const [topics, setTopics] = React.useState([])
  const [page, setPage] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(10)
  const [isLoading, setIsLoading] = React.useState(false)
  const navigate = useNavigate()

  const createHeaderConfig = (id, title, config) => {
    return {
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
  }

  const NoResponse = () => (
    <div className="no-response">
      ainda não há repostas, que tal contribuir?
    </div>
  )

  React.useEffect(() => {
    const fetchPromoted = async () => {
      try {
        setIsLoading(true)
        const url = `${env.apiAddress}/topics?page=${page + 1}&pageSize=${pageSize}&orderBy="promotions"`
        const res = await fetch(url, { method: "get" })
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
    <div className="content">
      {
        isLoading ?
          <div className="spinner" />
          :
          topics.length > 0 ?
            topics.map(topic => {
              const { id, title, promotions, upvotes, downvotes, config } = topic
              const allVotes = upvotes + downvotes
              const metrics = [
                `promovido por ${promotions} usuários`,
                allVotes ? `${(upvotes / allVotes) * 100}% dos ${allVotes} votantes achou relevante` : "0 votos",
                `${promotions + allVotes} interações`
              ]

              return (
                <Topic
                  title={<Link to={`/topics/${id}`}>{String(title)}</Link>}
                  headerConfig={createHeaderConfig(id, title, config)}
                  metrics={metrics}
                >
                  {topic.children?.length > 0 ?
                    topic.children.map(child => (
                      <PostSummary parent_id={id} id={child.id} shortAnswer={child.title}/>
                    ))
                    :
                    <NoResponse />
                  }
                </Topic>
              )
            })
            :
            <NoResponse />
      }
    </div>
  )
}