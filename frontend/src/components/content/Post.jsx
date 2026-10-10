import React from "react"
import { useNavigate } from "react-router"
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
import Alert from "@/components/primitives/Alert"
import { describe, limits, validate } from "@/assets/validation"
import Input from "@/components/primitives/Input"
import LoadingButton from "@/components/primitives/LoadingButton"
import { submitVote } from "@/assets/interactions"
import { Author, Interactions, Relevance } from "@/components/content/Metrics"
import { UserContext } from "@/context/UserContext"
import { relativeTime } from "@/assets/util"
import env from "@/assets/enviroment"
import useToLogin from "@/hooks/useToLogin"


export default function Post({
  id,
  author,
  author_avatar,
  author_id,
  parent_id,
  commit,
  title,
  titleRef,
  body,
  upvotes,
  downvotes,
  suggestions,
  interactionCounts,
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
  diffBase,
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
  // What's wrong with the edit or clone being sent, shown in its modal
  const [modalError, setModalError] = React.useState("")
  // Why accepting a suggestion failed, shown under the post
  const [mergeError, setMergeError] = React.useState("")
  const { user } = React.useContext(UserContext)
  const navigate = useNavigate()
  const toLogin = useToLogin()

  const readingHeaderCfg = {
    "branch": {
      description: "clonar post",
      icons: PiGitBranch,
      hide: author_id === user?.pid,
      onClick: () => {
        if (!user) {
          toLogin()
          return
        }
        setModalError("")
        setModal(3)
      }
    },
    "merge": {
      description: "incorporar sugestões",
      icons: ({ onClick, ...props }) => (
        <div className="iconWithBadge">
          <PiGitPullRequest onClick={onClick} {...props} />
          {suggestions?.length > 0 && <span onClick={onClick}>{suggestions.length}</span>}
        </div>
      ),
      hide: author_id !== user?.pid,
      disabled: () => !bubbleMenuShouldShow || !suggestions || suggestions?.length === 0,
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
      description: [`${author_id === user?.pid ? "realizar" : "sugerir"} edição`, "finalizar edição"],
      icons: [PiPencilSimple, PiPencilSimpleFill],
      initialValue: false,
      disabled: () => (!bubbleMenuShouldShow || alongsideCritique),
      onClick: (submit) => {
        if (!user) {
          toLogin()
          return
        }
        if (submit && content !== body) {
          setModalError("")
          setModal(1)
        }
        if (!submit)
          return { "critiquesVisible": false }
      }
    },
    "bookmark": {
      description: ["salvar post", "remover dos salvos"],
      icons: [PiBookmarkSimple, PiBookmarkSimpleFill],
      initialValue: userInteractions?.includes("bookmark") || false,
      onClick: () => submitVote(toLogin, id, "bookmark")
    }
  }

  const editingHeaderCfg = {
    "accept": {
      description: "aceitar sugestão",
      icons: PiCheck,
      onClick: async () => {
        const headers = user ? { "Authorization": `Bearer ${user.accessToken}` } : undefined
        const suggestionCommit = suggestions[currentSuggestion].config.commit
        try {
          setIsLoading(true)
          const res = await fetch(`${env.apiAddress}/contents/${id}/${suggestionCommit}/merge`, { method: "post", headers })

          if (res.ok)
            setPostData(prev => ({ ...prev, suggestions: suggestions.filter((_, i) => i !== currentSuggestion) }))
          else {
            const data = await res.json()
            // It changes passages the author also changed since: they choose what stays on its own page
            if (data.errorLocationCode === "GIT:MERGE:CONFLICT") {
              navigate(`/topics/${parent_id}/posts/${id}/suggestions/${suggestionCommit}`)
              return
            }
            setMergeError(data.message)
          }
        }
        catch (err) {
          console.error(err)
        }
        finally {
          setIsLoading(false)
        }
        setCurrentSuggestion(undefined)
        await fetchCommit()
      }
    },
    "reject": {
      description: "rejeitar sugestão",
      icons: PiTrash,
      onClick: async () => {
        const headers = user ? { "Authorization": `Bearer ${user.accessToken}` } : undefined
        try {
          setIsLoading(true)
          const res = await fetch(`${env.apiAddress}/contents/${id}/${suggestions[currentSuggestion].config.commit}/reject`, { method: "post", headers })

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
    // The counts as loaded, followed by the viewer's own votes since
    const interactions = {
      up: upvotes + (relevanceVote === "up") - (initialVoteState === "up"),
      down: downvotes + (relevanceVote === "down") - (initialVoteState === "down"),
      votes: (interactionCounts?.votes ?? 0) + Boolean(definitiveVote) - Boolean(userInteractions?.includes("vote")),
      critiques: interactionCounts?.critiques,
      suggestions: interactionCounts?.suggestions
    }

    return [
      <Author key="author" name={author} avatar={author_avatar} />,
      <Relevance key="relevance" {...{ initialVoteState, relevanceVote, upvotes, downvotes }}/>,
      <Interactions key="interactions" counts={interactions} heading="interações com o post" />
    ]
  }

  // The modal's input is named by `field`; problems with anything else are described in full
  const invalidMessage = (schema, values, field) => {
    const [invalid] = validate(schema, values).errors
    return invalid && (invalid.key === field ? invalid.message : describe(invalid).toLowerCase())
  }

  // Sends an edit or a clone, keeping the modal open with the API's message when it's refused
  const sendFromModal = async (url, method, values, onSuccess) => {
    try {
      setIsLoading(true)

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.accessToken}` },
        body: JSON.stringify(values)
      })

      const data = await res.json()

      if (!res.ok) {
        setModalError(data.message?.toLowerCase())
        return
      }

      onSuccess(data)
      setModal(false)
    }
    catch (err) {
      console.error(err)
      setModal(false)
    }
    finally {
      setIsLoading(false)
    }
  }

  const submitEdition = async () => {
    const values = { message: commitMessageRef?.current?.value.trim(), body: content }
    const invalid = invalidMessage("edit", values, "message")

    if (invalid) {
      setModalError(invalid)
      return
    }

    await sendFromModal(`${env.apiAddress}/contents/${id}`, "PATCH", values, data => {
      if (user?.pid === author_id)
        updatePostData(data)
    })
  }

  const submitClone = async () => {
    const values = { title: commitMessageRef?.current?.value.trim() }
    const invalid = invalidMessage("clone", values, "title")

    if (invalid) {
      setModalError(invalid)
      return
    }

    await sendFromModal(`${env.apiAddress}/contents/${id}/${commit}/clone`, "POST", values, data =>
      navigate(`/topics/${data.parent_id}/posts/${data.id}`))
  }


  return (
    <>
      <Frame
        id={id}
        title={String(title)}
        titleRef={titleRef}
        headerConfig={Number.isFinite(currentSuggestion) ? editingHeaderCfg : readingHeaderCfg}
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
          groupedCritiques={groupedCritiques}
          content={content}
          setContent={setContent}
          setShowCritique={setShowCritique}
          bubbleMenuShouldShow={bubbleMenuShouldShow}
          tempHighlight={tempHighlight}
          diffBase={diffBase}
          reset={reset}
        />
      </Frame>

      <Alert setter={setMergeError}>{mergeError}</Alert>

      <Modal isOpen={modal === 3} setIsOpen={setModal} title="clonar post">
        <div className="spaced">
          <Input
            ref={commitMessageRef}
            label="título da cópia"
            type="area"
            maxLength={limits.title.max}
            onChange={() => setModalError("")}
            errorMessage={modalError && `${modalError}!`}
          />
        </div>
        <div className="footer center">
          <button className="error" onClick={() => { setModal(false) }}>cancelar</button>
          <LoadingButton isLoading={isLoading} onClick={submitClone}>
            {isLoading ? "clonando..." : "clonar"}
          </LoadingButton>
        </div>
      </Modal>

      <Modal isOpen={modal === 2} setIsOpen={setModal} title="incorporar sugestões">
        <ul className="suggestions">
          {
            suggestions?.map((suggestion, index) => {
              const Dot = () => <span className="dot"> • </span>
              return <li key={suggestion.id}>
                <span
                  className="clickable"
                  title="visualizar sugestão"
                  onClick={() => { fetchCommit(suggestion.config.commit); setCurrentSuggestion(index); setModal(false) }}
                >
                  {suggestion.config.message}
                </span>
                <div className="description"><Author name={suggestion.author} avatar={suggestion.author_avatar}/><Dot />{relativeTime(suggestion.created_at)}</div>
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
            maxLength={limits.message.max}
            onChange={() => setModalError("")}
            errorMessage={modalError && `${modalError}!`}
          />
        </div>
        <div className="footer center">
          <button
            className="error"
            onClick={() => {
              setContent(body);
              setReset(!reset);
              setModal(false)
            }}
          >
            descartar
          </button>
          <LoadingButton isLoading={isLoading} onClick={submitEdition}>
            {isLoading ? "enviando..." : "enviar"}
          </LoadingButton>
        </div>
      </Modal>
    </>
  )
}
