import React from "react"
import {
  PiBookmarkSimple,
  PiBookmarkSimpleFill,
  PiArrowBendUpLeft,
  PiCaretDoubleUp
} from "react-icons/pi"
import { Link, useNavigate } from "react-router-dom"

import Topic from "@/components/Topic"
import PostSummary from "@/components/PostSummary"
import { submitVote } from "@/components/VotingButtons"
import env from "@/assets/enviroment"


export default function Promoted() {
  const [topics, setTopics] = React.useState([])
  const [page, setPage] = React.useState(0)
  const [pageSize, setPageSize] = React.useState(10)
  const [isLoading, setIsLoading] = React.useState(false)
  const navigate = useNavigate()

  const createHeaderConfig = (id, title, config, initalBookmark) => {
    return {
      "answer": {
        description: "responder tópico",
        icons: PiArrowBendUpLeft,
        onClick: () => navigate("/write", { state: { id, title, config } })
      },
      "promote": {
        description: "promover tópico",
        icons: PiCaretDoubleUp,
        onClick: () => { }
      },
      "bookmark": {
        description: ["salvar tópico", "remover tópico dos salvos"],
        icons: [PiBookmarkSimple, PiBookmarkSimpleFill],
        initialValue: initalBookmark,
        onClick: () => submitVote(navigate, id, "bookmark")
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
            topics.map(topic => {
              const { id, author, title, promotions, upvotes, downvotes, config, children, childrenStats, userInteractions } = topic
              const allVotes = upvotes + downvotes
              const interactions = childrenStats.upvotes + childrenStats.downvotes
              const metrics = [
                `iniciado por ${author}`,
                `promovido por ${promotions} usuário${promotions === 1 ? "" : "s"}`,
                allVotes ? `${(upvotes / allVotes) * 100}% dos ${allVotes} votantes achou relevante` : "0 votos",
                `${childrenStats.count} post${childrenStats.count === 1 ? "" : "s"}`,
                `${interactions} interaç${interactions === 1 ? "ão" : "ões"}`
              ]
              const relevance = userInteractions ? userInteractions.filter(v => v === "up" || v === "down")[0] : ""

              return (
                <Topic
                  id={id}
                  title={<Link to={`/topics/${id}`}>{String(title)}</Link>}
                  initialVoteState={{ relevance }}
                  headerConfig={createHeaderConfig(id, title, config, userInteractions.includes("bookmark"))}
                  metrics={metrics}
                >
                  {children?.length > 0 ?
                    children.map(child => (
                      <PostSummary
                        parent_id={id}
                        id={child.id}
                        shortAnswer={child.title}
                        percentage={((child.upvotes / childrenStats.upvotes) * 100) || 0}
                      />
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