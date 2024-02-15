import React from "react"
import { useNavigate } from "react-router-dom"
import {
  PiBookmarkSimple,
  PiBookmarkSimpleFill,
  PiPencilSimpleFill,
  PiPencilSimple,
  PiGitBranch,
  PiTrashFill
} from "react-icons/pi"

import TextEditor from "@/components/TextEditor"
import Frame from "@/components/Frame"
import Modal from "@/components/Modal"
import { submitVote } from "@/components/VotingButtons"
import { toPercentageStr } from "@/assets/util"


export default function Post({
  id,
  author,
  title,
  body,
  upvotes,
  downvotes,
  config,
  alongsideCritique,
  setShowCritique,
  userInteractions
}) {
  const initialVoteState = userInteractions?.filter(v => v === "up" || v === "down")[0]
  const [relevanceVote, setRelevanceVote] = React.useState(initialVoteState)
  const [definitiveVote, setDefinitiveVote] = React.useState(userInteractions?.includes("vote"))
  const [content, setContent] = React.useState(body)
  const [reset, setReset] = React.useState(false)
  const [modal, setModal] = React.useState(false)
  const navigate = useNavigate()

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
      onClick: submit => (submit && content !== body) && setModal(true)
    },
    "bookmark": {
      description: ["salvar tópico", "remover tópico dos salvos"],
      icons: [PiBookmarkSimple, PiBookmarkSimpleFill],
      initialValue: userInteractions?.includes("bookmark") || false,
      onClick: () => submitVote(navigate, id, "bookmark")
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
    <>
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
          initialContent={body}
          content={content}
          setContent={setContent}
          setShowCritique={setShowCritique}
          reset={reset}
        />
      </Frame>

      <Modal isOpen={modal} setIsOpen={setModal} title="o que fazer com a edição?">
        <div className="footer center">
          <button className="error" onClick={() => { setContent(body); setReset(!reset); setModal(false) }}>cancelar</button>
          <button>enviar</button>
        </div>
      </Modal>
    </>
  )
}