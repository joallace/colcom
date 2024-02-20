import React from "react"
import { useNavigate } from "react-router-dom"
import {
  PiBookmarkSimple,
  PiBookmarkSimpleFill,
  PiPencilSimpleFill,
  PiPencilSimple,
  PiGitBranch,
  PiEye,
  PiEyeClosed
} from "react-icons/pi"

import TextEditor from "@/components/TextEditor"
import Frame from "@/components/Frame"
import Modal from "@/components/Modal"
import Input from "@/components/Input"
import { submitVote } from "@/components/VotingButtons"
import { UserContext } from "@/context/UserContext"
import { toPercentageStr, getUserVote } from "@/assets/util"
import env from "@/assets/enviroment"


export default function Post({
  id,
  author,
  author_id,
  title,
  titleRef,
  body,
  upvotes,
  downvotes,
  config,
  critiques,
  alongsideCritique,
  setShowCritique,
  userInteractions,
  setPostData,
  bubbleMenuShouldShow,
  resetState
}) {
  const initialVoteState = userInteractions?.filter(v => v === "up" || v === "down")[0]
  const [relevanceVote, setRelevanceVote] = React.useState(initialVoteState)
  const [definitiveVote, setDefinitiveVote] = React.useState(userInteractions?.includes("vote"))
  const [content, setContent] = React.useState(body)
  const [modal, setModal] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const [reset, setReset] = resetState
  const commitMessageRef = React.useRef()
  const { user } = React.useContext(UserContext)
  const navigate = useNavigate()

  const headerConfig = {
    "branch": {
      description: "clonar post",
      icons: PiGitBranch,
      onClick: () => { }
    },
    "critiquesVisible": {
      description: ["exibir críticas", "omitir críticas"],
      icons: [PiEyeClosed, PiEye],
      initialValue: true,
      disabled: status => (status.edit || alongsideCritique),
      onClick: () => { }
    },
    "edit": {
      description: ["sugerir edição no post", "finalizar edição"],
      icons: [PiPencilSimple, PiPencilSimpleFill],
      initialValue: false,
      disabled: () => (!bubbleMenuShouldShow || alongsideCritique),
      onClick: (submit) => {
        if (submit && content !== body)
          setModal(true)
        if (!submit)
          return { "critiquesVisible": false }
      }
    },
    "bookmark": {
      description: ["salvar post", "remover post dos salvos"],
      icons: [PiBookmarkSimple, PiBookmarkSimpleFill],
      initialValue: userInteractions?.includes("bookmark") || false,
      onClick: () => submitVote(navigate, id, "bookmark")
    }
  }

  const getMetrics = () => {
    const removeOrAddVote = initialVoteState ? -(relevanceVote === "") : +(relevanceVote === "up" || relevanceVote === "down")
    const allVotes = upvotes + downvotes + removeOrAddVote
    return [
      `iniciado por ${author}`,
      allVotes ? `${toPercentageStr((upvotes + getUserVote(initialVoteState, relevanceVote)) / allVotes)} dos ${allVotes} votantes achou relevante` : "0 votos",
      `${allVotes} interações`
    ]
  }

  const submit = async () => {
    const message = commitMessageRef?.current?.value

    if (!message) {
      // setError(true)
      return
    }

    const token = localStorage.getItem("accessToken")
    if (!token) {
      navigate("/login")
      return
    }

    try {
      setIsLoading(true)

      const url = `${env.apiAddress}/contents/${id}`
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ message, body: content })
      })

      const data = await res.json()

      if (res.ok && user.pid === author_id)
        setPostData(data)
    }
    catch (err) {
      console.error(err)
    }
    finally {
      setIsLoading(false)
      setModal(false)
    }
  }

  return (
    <>
      <Frame
        id={id}
        title={title}
        titleRef={titleRef}
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
          critiques={critiques}
          content={content}
          setContent={setContent}
          // showCritiques={}
          setShowCritique={setShowCritique}
          bubbleMenuShouldShow={bubbleMenuShouldShow}
          reset={reset}
        />
      </Frame>

      <Modal isOpen={modal} setIsOpen={setModal} title="o que fazer com a edição?">
        <div className="spaced">
          <Input
            ref={commitMessageRef}
            label="resumo das alterações"
            type="area"
          />
        </div>
        <div className="footer center">
          <button className="error" onClick={() => { setContent(body); setReset(!reset); setModal(false) }}>cancelar</button>
          <button disabled={isLoading}  onClick={submit}>
            {isLoading ?
              <><div className="button spinner"></div>enviando...</>
              :
              "enviar"
            }
          </button>
        </div>
      </Modal>
    </>
  )
}