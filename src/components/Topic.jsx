import React from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  PiBookmarkSimple,
  PiBookmarkSimpleFill,
  PiArrowBendUpLeft,
  PiCaretDoubleUp
} from "react-icons/pi"

import Frame from "@/components/primitives/Frame"
import PostSummary from "@/components/PostSummary"
import NoResponse from "@/components/primitives/NoResponse"
import { submitVote } from "@/components/primitives/VotingButtons"
import { UserContext } from "@/context/UserContext"
import { toPercentageStr, getUserVote } from "@/assets/util"


export default function Topic({
  id,
  author,
  title,
  promotions,
  upvotes,
  downvotes,
  config,
  children,
  childrenStats,
  userInteractions,
  userVote
}) {
  const initialVoteState = userInteractions?.filter(v => v === "up" || v === "down")[0]
  const [relevanceVote, setRelevanceVote] = React.useState(initialVoteState)
  const [definitiveVote, setDefinitiveVote] = React.useState(userVote)
  const { user } = React.useContext(UserContext)
  const navigate = useNavigate()

  const headerConfig = {
    "answer": {
      description: "responder tópico",
      icons: PiArrowBendUpLeft,
      onClick: () => navigate("/write", { state: { id, title, config } })
    },
    "promote": {
      description: "promover tópico",
      icons: PiCaretDoubleUp,
      onClick: () => submitVote(navigate, id, "promote",)
    },
    "bookmark": {
      description: ["salvar tópico", "remover tópico dos salvos"],
      icons: [PiBookmarkSimple, PiBookmarkSimpleFill],
      initialValue: userInteractions?.includes("bookmark") || false,
      onClick: () => submitVote(navigate, id, "bookmark")
    }
  }

  const getMetrics = () => {
    const removeOrAddVote = initialVoteState ? -(relevanceVote === "") : +(relevanceVote === "up" || relevanceVote === "down")
    const allVotes = upvotes + downvotes + removeOrAddVote
    const interactions = childrenStats?.upvotes + childrenStats?.downvotes

    return [
      `iniciado por ${author}`,
      `promovido por ${promotions} usuário${promotions === 1 ? "" : "s"}`,
      allVotes ? `${toPercentageStr((upvotes + getUserVote(initialVoteState, relevanceVote)) / allVotes)} dos ${allVotes} votantes achou relevante` : "0 votos",
      `${childrenStats?.count} post${childrenStats?.count === 1 ? "" : "s"}`,
      `${interactions} interaç${interactions === 1 ? "ão" : "ões"}`
    ]
  }

  return (
    <Frame
      id={id}
      title={<Link to={`/topics/${id}`}>{String(title)}</Link>}
      relevanceVote={relevanceVote}
      setRelevanceVote={setRelevanceVote}
      definitiveVote={definitiveVote}
      setDefinitiveVote={setDefinitiveVote}
      headerConfig={headerConfig}
      metrics={getMetrics}
    >
      {children?.length > 0 ?
        <>
          {children.map((child, i) => (
            <PostSummary
              key={`p${id}-s${child.id}`}
              parent_id={id}
              id={child.id}
              shortAnswer={`${i+1}. ${child.title}`}
              summary={`${child.body}${child.body.length === 280 ? "..." : ""}`}
              percentage={child.votes / childrenStats?.votes}
              isAuthor={user?.pid === child.author_id}
              chosen={userVote === child.id}
            />
          ))}
          {childrenStats?.count > children.length &&
            <Link to={`/topics/${id}`} style={{ width: "min-content", whiteSpace: "nowrap", fontWeight: "bolder", fontSize: "1.5rem" }}>. . .</Link>
          }
        </>
        :
        <NoResponse />
      }
    </Frame>
  )
}