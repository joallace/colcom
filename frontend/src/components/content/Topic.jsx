import React from "react"
import { Link, useNavigate } from "react-router"
import {
  PiBookmarkSimple,
  PiBookmarkSimpleFill,
  PiArrowBendUpLeft
} from "react-icons/pi"

import Frame from "@/components/primitives/Frame"
import PostSummary from "@/components/content/PostSummary"
import NoResponse from "@/components/primitives/NoResponse"
import { submitVote } from "@/assets/interactions"
import { Author, Interactions, PostCount, Promotions, Relevance } from "@/components/content/Metrics"
import { UserContext } from "@/context/UserContext"


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
    const interactions = childrenStats?.upvotes + childrenStats?.downvotes
    
    return [
      <Author key="author" name={author} avatar={author_avatar} />,
      <Promotions
        key="promotions"
        userIsPromoting={userInteractions?.includes("promote")}
        userPromotingTopicId={user?.promoting}
        topicId={id}
        promotionCount={promotions}
      />,
      <Relevance key="relevance" {...{ initialVoteState, relevanceVote, upvotes, downvotes }} />,
      <PostCount key="posts" count={childrenStats?.count} />,
      <Interactions key="interactions" count={interactions} />
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
              index={i}
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
