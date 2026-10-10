import React from "react"
import { Link } from "react-router"
import { PiBookmarkSimple, PiBookmarkSimpleFill } from "react-icons/pi"
import DOMPurify from "dompurify"

import Frame from "@/components/primitives/Frame"
import Excerpt from "@/components/content/Excerpt"
import { submitVote } from "@/assets/interactions"
import { hasMatch } from "@/assets/search"
import { Author, Relevance } from "@/components/content/Metrics"
import useToLogin from "@/hooks/useToLogin"


const SUMMARY_LENGTH = 280

// A post outside its own page (profile, bookmarks, search): which topic it answers and its summary,
// or, as a search result, the passage that matched
export default function PostPreview({ id, title, body, author, author_avatar, upvotes, downvotes, config, topic, userInteractions, excerpt }) {
  const initialVoteState = userInteractions?.filter(v => v === "up" || v === "down")[0]
  const [relevanceVote, setRelevanceVote] = React.useState(initialVoteState)
  const toLogin = useToLogin()
  const path = `/topics/${topic.id}/posts/${id}`

  const headerConfig = {
    "bookmark": {
      description: ["salvar post", "remover dos salvos"],
      icons: [PiBookmarkSimple, PiBookmarkSimpleFill],
      initialValue: userInteractions?.includes("bookmark") || false,
      onClick: () => submitVote(toLogin, id, "bookmark")
    }
  }

  const getMetrics = () => [
    <Author key="author" name={author} avatar={author_avatar} />,
    <Relevance key="relevance" {...{ initialVoteState, relevanceVote, upvotes, downvotes }} />
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
      {hasMatch(excerpt) ?
        <Excerpt excerpt={excerpt} />
        :
        <div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(`${body ?? ""}${body?.length === SUMMARY_LENGTH ? "..." : ""}`) }} />
      }
    </Frame>
  )
}
