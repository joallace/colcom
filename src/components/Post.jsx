import React from "react"
import {
  PiBookmarkSimple,
  PiBookmarkSimpleFill,
  PiPencilSimpleFill,
  PiPencilSimple,
  PiGitBranch
} from "react-icons/pi"

import TextEditor from "@/components/TextEditor"
import Frame from "@/components/Frame"
import { toPercentageStr } from "@/assets/util"


export default function Post({
  id,
  author,
  title,
  body,
  upvotes,
  downvotes,
  config,
  children,
  childrenStats,
  alongsideCritique,
  setShowCritique,
  userInteractions
}) {
  const initialVoteState = userInteractions?.filter(v => v === "up" || v === "down")[0]
  const [relevanceVote, setRelevanceVote] = React.useState(initialVoteState)
  const [definitiveVote, setDefinitiveVote] = React.useState(userInteractions?.includes("vote"))
  const [content, setContent] = React.useState(body)

  const headerConfig = {
    "branch": {
      description: "clonar tópico",
      icons: PiGitBranch,
      onClick: () => { }
    },
    "edit": {
      description: ["sugerir edição no post", "finalizar edição"],
      icons: [PiPencilSimple, PiPencilSimpleFill],
      initialValue: false,
      onClick: () => { }
    },
    "bookmark": {
      description: ["salvar tópico", "remover tópico dos salvos"],
      icons: [PiBookmarkSimple, PiBookmarkSimpleFill],
      initialValue: false,
      onClick: () => { }
    }
  }

  const updateVoteMetric = () => {
    if (relevanceVote === initialVoteState)
      return 0
    if (relevanceVote === "up" && (initialVoteState === "down" || !initialVoteState))
      return 1
    if ((relevanceVote === "down" || !relevanceVote) && initialVoteState === "up")
      return -1

    return 0
  }

  const getMetrics = () => {
    const removeOrAddVote = initialVoteState ? -(relevanceVote === "") : +(relevanceVote === "up" || relevanceVote === "down")
    const allVotes = upvotes + downvotes + removeOrAddVote
    return [
      `iniciado por ${author}`,
      allVotes ? `${toPercentageStr(upvotes + updateVoteMetric() / allVotes)} dos ${allVotes} votantes achou relevante` : "0 votos",
      `${allVotes} interações`
    ]
  }

  return (
    <Frame
      id={id}
      title={title}
      headerConfig={headerConfig}
      relevanceVote={relevanceVote}
      setRelevanceVote={setRelevanceVote}
      definitiveVote={definitiveVote}
      setDefinitiveVote={setDefinitiveVote}
      metrics={getMetrics}
      alongsideCritique={alongsideCritique}
      showDefinitiveVoteButton
      justify
    >
      <TextEditor
        content={content}
        setContent={setContent}
        setShowCritique={setShowCritique}
      />
    </Frame>
  )
}