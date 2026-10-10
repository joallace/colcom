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
import { Author, Interactions, PollShare, Relevance } from "@/components/content/Metrics"
import { UserContext } from "@/context/UserContext"
import { relativeTime } from "@/assets/util"
import api, { ApiError } from "@/assets/api"
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
  userTopicVote,
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
  // Whether the viewer has voted here since loading, which moved any vote they had on another post
  const [voteMovedHere, setVoteMovedHere] = React.useState(false)
  if (definitiveVote && !voteMovedHere)
    setVoteMovedHere(true)
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
        const suggestionCommit = suggestions[currentSuggestion].config.commit
        try {
          setIsLoading(true)
          await api.post(`/contents/${id}/${suggestionCommit}/merge`)
          setPostData(prev => ({ ...prev, suggestions: suggestions.filter((_, i) => i !== currentSuggestion) }))
        }
        catch (err) {
          if (!(err instanceof ApiError))
            console.error(err)
          // It changes passages the author also changed since: they choose what stays on its own page
          else if (err.errorLocationCode === "GIT:MERGE:CONFLICT") {
            navigate(`/topics/${parent_id}/posts/${id}/suggestions/${suggestionCommit}`)
            return
          }
          else
            setMergeError(err.message)
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
        try {
          setIsLoading(true)
          await api.post(`/contents/${id}/${suggestions[currentSuggestion].config.commit}/reject`)
          setPostData(prev => ({ ...prev, suggestions: suggestions.filter((_, i) => i !== currentSuggestion) }))
        }
        catch (err) {
          // A refusal leaves the suggestion listed, as before
          if (!(err instanceof ApiError))
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
    const votedHere = Boolean(userInteractions?.includes("vote"))
    // A vote on another post of the topic still counts in the poll, until voting here moves it
    const votedElsewhere = userTopicVote != null && !votedHere && !voteMovedHere
    const pollVotes = (interactionCounts?.votes ?? 0) + Boolean(definitiveVote) - votedHere
    const topicVotes = (interactionCounts?.topicVotes ?? 0) + (Boolean(definitiveVote) || votedElsewhere) - (votedHere || userTopicVote != null)

    const interactions = {
      up: upvotes + (relevanceVote === "up") - (initialVoteState === "up"),
      down: downvotes + (relevanceVote === "down") - (initialVoteState === "down"),
      critiques: interactionCounts?.critiques,
      suggestions: interactionCounts?.suggestions
    }

    return [
      <Author key="author" name={author} avatar={author_avatar} />,
      <PollShare key="poll" votes={pollVotes} total={topicVotes} />,
      <Relevance key="relevance" {...{ initialVoteState, relevanceVote, upvotes, downvotes }}/>,
      <Interactions key="interactions" counts={interactions} heading="interações com o post" omit={["votes"]} />
    ]
  }

  // The modal's input is named by `field`; problems with anything else are described in full
  const invalidMessage = (schema, values, field) => {
    const [invalid] = validate(schema, values).errors
    return invalid && (invalid.key === field ? invalid.message : describe(invalid).toLowerCase())
  }

  // Sends an edit or a clone, keeping the modal open with the API's message when it's refused
  const sendFromModal = async (send, onSuccess) => {
    try {
      setIsLoading(true)
      onSuccess(await send())
      setModal(false)
    }
    catch (err) {
      if (err instanceof ApiError) {
        setModalError(err.data.message?.toLowerCase())
        return
      }
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

    await sendFromModal(() => api.patch(`/contents/${id}`, values), data => {
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

    await sendFromModal(() => api.post(`/contents/${id}/${commit}/clone`, values), data =>
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
          // Highlights over a suggestion would hide what it changes. Closing, accepting or rejecting
          // it loads a version again, which remounts the post with its critiques
          groupedCritiques={Number.isFinite(currentSuggestion) ? [] : groupedCritiques}
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
