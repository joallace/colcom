import React from "react"
import { Link, useNavigate } from "react-router-dom"
import {
  PiBookmarkSimple,
  PiBookmarkSimpleFill,
  PiArrowBendUpLeft,
  PiCaretDoubleUp
} from "react-icons/pi"

import Frame from "@/components/primitives/Frame"
import PostSummary from "@/components/content/PostSummary"
import NoResponse from "@/components/primitives/NoResponse"
import { submitVote } from "@/components/primitives/VotingButtons"
import { Author, Interactions, PostCount, Promotions, Relevance } from "@/components/content/Metrics"
import { UserContext } from "@/context/UserContext"
import { getUserVote } from "@/assets/util"


export default function Topic({
  id,
  author,
  author_avatar,
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
  const { user, updatePromoted } = React.useContext(UserContext)
  const navigate = useNavigate()

  const headerConfig = {
    "answer": {
      description: "responder ao tópico",
      icons: PiArrowBendUpLeft,
      onClick: () => { user ? navigate("/write", { state: { id, title, config } }) : navigate("/login") }
    },
    "bookmark": {
      description: ["salvar tópico", "remover dos salvos"],
      icons: [PiBookmarkSimple, PiBookmarkSimpleFill],
      initialValue: userInteractions?.includes("bookmark") || false,
      onClick: () => submitVote(navigate, id, "bookmark")
    }
  }

  const getMetrics = () => {
    const removeOrAddVote = initialVoteState ? -(relevanceVote === "") : +(relevanceVote === "up" || relevanceVote === "down")
    const allVotes = upvotes + downvotes + removeOrAddVote

    const interactions = childrenStats?.upvotes + childrenStats?.downvotes

    const removeOrAddPromote = userInteractions?.includes("promote") ? -(user?.promoting !== id) : +(user?.promoting === id)
    const currentPromotions = promotions + removeOrAddPromote
    const upvotePercentage = allVotes ? (upvotes + getUserVote(initialVoteState, relevanceVote)) / allVotes : 0

    return [
      <Author name={author} avatar={author_avatar} />,
      <Promotions count={currentPromotions}/>,
      <Relevance {...{allVotes, upvotePercentage}}/>,
      <PostCount count={childrenStats?.count}/>,
      <Interactions count={interactions}/>
    ]
  }

  return (
    <Frame
      id={id}
      title={<Link to={`/topics/${id}`}>{String(title)}</Link>}
      headerConfig={headerConfig}
      relevanceVote={relevanceVote}
      setRelevanceVote={setRelevanceVote}
      definitiveVote={user?.promoting}
      setDefinitiveVote={updatePromoted}
      definitiveVoteType="promote"
      showDefinitiveVoteButton
      metrics={getMetrics}
    >
      {children?.length > 0 ?
        <>
          {children.map((child, i) => (
            <PostSummary
              key={`p${id}-s${child.id}`}
              parent_id={id}
              id={child.id}
              shortAnswer={`${i + 1}. ${child.title}`}
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
