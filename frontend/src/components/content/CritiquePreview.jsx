import React from "react"
import { Link } from "react-router"
import { PiBookmarkSimple, PiBookmarkSimpleFill } from "react-icons/pi"

import { default as Editor } from "@/components/Editor"
import Frame from "@/components/primitives/Frame"
import { submitVote } from "@/assets/interactions"
import { Author, Relevance } from "@/components/content/Metrics"
import { readableText } from "@/assets/textIndex"
import useToLogin from "@/hooks/useToLogin"


// A critique outside its post (profile, bookmarks): the post and passage it criticises. Its title
// opens the post at the criticised version with the critique open.
export default function CritiquePreview({ id, title, body, author, author_avatar, upvotes, downvotes, config, post, topic, userInteractions }) {
  const initialVoteState = userInteractions?.filter(v => v === "up" || v === "down")[0]
  const [relevanceVote, setRelevanceVote] = React.useState(initialVoteState)
  const toLogin = useToLogin()
  const postPath = `/topics/${topic.id}/posts/${post.id}`
  const critiquePath = `${postPath}?${new URLSearchParams({ commit: config?.commit ?? "", critique: id })}`

  const headerConfig = {
    "bookmark": {
      description: ["salvar crítica", "remover dos salvos"],
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
      title={<Link to={critiquePath}>{String(title)}</Link>}
      headerConfig={headerConfig}
      relevanceVote={relevanceVote}
      setRelevanceVote={setRelevanceVote}
      metrics={getMetrics}
      isCritique
      justify
    >
      <div className="contentContext">
        criticando o post <Link to={postPath}>{post.title}</Link>
      </div>
      {config?.quote && <blockquote className="criticisedPassage">{readableText(config.quote.exact)}</blockquote>}
      <Editor initialContent={body} content={body} reset={body} bubbleMenuShouldShow={false} />
    </Frame>
  )
}
