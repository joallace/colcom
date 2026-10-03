import React from "react"
import { Link, useNavigate } from "react-router"
import { PiBookmarkSimple, PiBookmarkSimpleFill } from "react-icons/pi"
import DOMPurify from "dompurify"

import Frame from "@/components/primitives/Frame"
import { submitVote } from "@/components/primitives/VotingButtons"
import { Author, Relevance } from "@/components/content/Metrics"


const SUMMARY_LENGTH = 280

// A post outside its own page (profile, bookmarks): which topic it answers and its summary
export default function PostPreview({ id, title, body, author, author_avatar, upvotes, downvotes, config, topic, userInteractions }) {
  const initialVoteState = userInteractions?.filter(v => v === "up" || v === "down")[0]
  const [relevanceVote, setRelevanceVote] = React.useState(initialVoteState)
  const navigate = useNavigate()
  const path = `/topics/${topic.id}/posts/${id}`

  const headerConfig = {
    "bookmark": {
      description: ["salvar post", "remover dos salvos"],
      icons: [PiBookmarkSimple, PiBookmarkSimpleFill],
      initialValue: userInteractions?.includes("bookmark") || false,
      onClick: () => submitVote(navigate, id, "bookmark")
    }
  }

  const getMetrics = () => [
    <Author name={author} avatar={author_avatar} />,
    <Relevance {...{ initialVoteState, relevanceVote, upvotes, downvotes }} />
  ]

  return (
    <Frame
      id={id}
      title={<Link to={path}>{String(title)}</Link>}
      headerConfig={headerConfig}
      relevanceVote={relevanceVote}
      setRelevanceVote={setRelevanceVote}
      metrics={getMetrics}
      justify
    >
      <div className="contentContext">
        respondendo ao tópico <Link to={`/topics/${topic.id}`}>{topic.title}</Link>
        {config?.answer && <> com <strong>{config.answer}</strong></>}
      </div>
      <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(`${body ?? ""}${body?.length === SUMMARY_LENGTH ? "..." : ""}`) }} />
    </Frame>
  )
}
