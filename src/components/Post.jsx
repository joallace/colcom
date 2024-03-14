import React from "react"
import { useNavigate, Link } from "react-router-dom"
import {
  PiBookmarkSimple,
  PiBookmarkSimpleFill,
  PiPencilSimpleFill,
  PiPencilSimple,
  PiGitBranch,
  PiGitPullRequest,
  PiEye,
  PiEyeClosed,
  PiCheck,
  PiTrash,
  PiX
} from "react-icons/pi"

import { default as Editor } from "@/components/Editor"
import Frame from "@/components/primitives/Frame"
import Modal from "@/components/primitives/Modal"
import Input from "@/components/primitives/Input"
import { submitVote } from "@/components/primitives/VotingButtons"
import { UserContext } from "@/context/UserContext"
import { toPercentageStr, getUserVote, relativeTime } from "@/assets/util"
import env from "@/assets/enviroment"


export default function Post({
  id,
  parent_id,
  author,
  author_id,
  commit,
  title,
  titleRef,
  body,
  upvotes,
  downvotes,
  critiques,
  suggestions,
  fetchCommit,
  groupedCritiques,
  alongsideCritique,
  setShowCritique,
  userInteractions,
  updatePostData,
  setPostData,
  bubbleMenuShouldShow,
  resetState = [],
  tempHighlight,
  currentSuggestion,
  setCurrentSuggestion
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
      hide: author_id === user?.pid,
      onClick: () => { setModal(3) }
    },
    "merge": {
      description: "incorporar sugestões ao post",
      icons: ({ onClick, ...props }) => (
        <div className="iconWithBadge">
          <PiGitPullRequest onClick={onClick} {...props} />
          {suggestions?.length > 0 && <span onClick={onClick}>{suggestions.length}</span>}
        </div>
      ),
      hide: author_id !== user?.pid,
      disabled: () => !suggestions || suggestions?.length === 0,
      onClick: () => { setModal(2) }
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
          setModal(1)
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

  const editionHeader = {
    "accept": {
      description: "aceitar sugestão",
      icons: PiCheck,
      onClick: async () => {
        const token = localStorage.getItem("accessToken")
        const headers = token ? { "Authorization": `Bearer ${token}` } : undefined
        try {
          setIsLoading(true)
          const res = await fetch(`${env.apiAddress}/contents/${id}/${suggestions[currentSuggestion].config.commit}/merge`, { headers })

          if (res.ok)
            setPostData(prev => ({ ...prev, suggestions: suggestions.filter((_, i) => i !== currentSuggestion) }))
        }
        catch (err) {
          console.error(err)
        }
        finally {
          setCurrentSuggestion(undefined)
          setIsLoading(false)
          await fetchCommit()
        }
      }
    },
    "reject": {
      description: "rejeitar sugestão",
      icons: PiTrash,
      onClick: async () => {
        const token = localStorage.getItem("accessToken")
        const headers = token ? { "Authorization": `Bearer ${token}` } : undefined
        try {
          setIsLoading(true)
          const res = await fetch(`${env.apiAddress}/interactions/${suggestions[currentSuggestion].config.commit}/reject`, { headers })

          if (res.ok)
            setPostData(prev => ({ ...prev, suggestions: suggestions.filter((_, i) => i !== currentSuggestion) }))
        }
        catch (err) {
          console.error(err)
        }
        finally {
          setCurrentSuggestion(undefined)
          setIsLoading(false)
          await fetchCommit()
        }
      }
    },
    "close": {
      description: "fechar sugestão",
      icons: PiX,
      onClick: async () => { await fetchCommit(); setCurrentSuggestion(undefined) }
    },
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

  const submitEdition = async () => {
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

      if (res.ok && user?.pid === author_id)
        updatePostData(data)
    }
    catch (err) {
      console.error(err)
    }
    finally {
      setIsLoading(false)
      setModal(false)
    }
  }

  const submitClone = async () => {
    const title = commitMessageRef?.current?.value

    if (!title) {
      return
    }

    const token = localStorage.getItem("accessToken")
    if (!token) {
      navigate("/login")
      return
    }

    try {
      setIsLoading(true)

      const url = `${env.apiAddress}/contents/${id}/${commit}/clone`
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ title })
      })

      const data = await res.json()

      if (res.ok && data)
        navigate(`/topics/${data.parent_id}/posts/${data.id}`)
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
        title={<Link to={`/topics/${parent_id}/posts/${id}`}>{String(title)}</Link>}
        titleRef={titleRef}
        headerConfig={Number.isFinite(currentSuggestion) ? editionHeader : headerConfig}
        relevanceVote={relevanceVote}
        setRelevanceVote={setRelevanceVote}
        definitiveVote={definitiveVote}
        setDefinitiveVote={setDefinitiveVote}
        definitiveVoteType="vote"
        showDefinitiveVoteButton
        metrics={getMetrics}
        alongsideCritique={alongsideCritique}
        justify
      >
        <Editor
          initialContent={body}
          critiques={critiques}
          groupedCritiques={groupedCritiques}
          content={content}
          setContent={setContent}
          setShowCritique={setShowCritique}
          bubbleMenuShouldShow={bubbleMenuShouldShow}
          tempHighlight={tempHighlight}
          reset={reset}
        />
      </Frame>

      <Modal isOpen={modal === 3} setIsOpen={setModal} title="clonar post">
        <div className="spaced">
          <Input
            ref={commitMessageRef}
            label="título da cópia"
            type="area"
          />
        </div>
        <div className="footer center">
          <button className="error" onClick={() => { setModal(false) }}>cancelar</button>
          <button disabled={isLoading} onClick={submitClone}>
            {isLoading ?
              <><div className="button spinner"></div>clonando...</>
              :
              "clonar"
            }
          </button>
        </div>
      </Modal>

      <Modal isOpen={modal === 2} setIsOpen={setModal} title="incorporar sugestões">
        <ul className="suggestions">
          {
            suggestions?.map((suggestion, index) => {
              const Dot = () => <span className="dot"> • </span>
              return <li>
                <span
                  className="icons"
                  title="visualizar sugestão"
                  onClick={() => { fetchCommit(suggestion.config.commit); setCurrentSuggestion(index); setModal(false) }}
                >
                  {suggestion.config.message}
                </span>
                <div className="description">por {suggestion.author}<Dot />{relativeTime(suggestion.created_at)}</div>
              </li>
            })
          }
        </ul>
      </Modal>

      <Modal isOpen={modal === 1} setIsOpen={setModal} title="o que fazer com a edição?">
        <div className="spaced">
          <Input
            ref={commitMessageRef}
            label="resumo das alterações"
            type="area"
          />
        </div>
        <div className="footer center">
          <button className="error" onClick={() => { setContent(body); setReset(!reset); setModal(false) }}>cancelar</button>
          <button disabled={isLoading} onClick={submitEdition}>
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