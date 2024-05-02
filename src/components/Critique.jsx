import React from "react"
import { useNavigate } from 'react-router-dom'
import {
  PiBookmarkSimple,
  PiBookmarkSimpleFill,
  PiCheck,
  PiX
} from "react-icons/pi"

import { default as Editor } from "@/components/Editor"
import Frame from "@/components/primitives/Frame"
import { submitVote } from "@/components/primitives/VotingButtons"
import useBreakpoint from "@/hooks/useBreakpoint"
import { toPercentageStr, getUserVote } from "@/assets/util"
import env from "@/assets/enviroment"
import useUser from "@/context/UserContext"


function getSelectionHeight() {
  if (window.getSelection) {
    const selection = window.getSelection()
    if (selection.rangeCount) {
      const range = selection.getRangeAt(0).cloneRange()
      if (range.getBoundingClientRect) {
        // Sometimes, when selecting a whole paragraph, we can't get the selection rect
        // so we can just pick it from the starting container
        const rect = range?.getBoundingClientRect()?.top ? range?.getBoundingClientRect() : range?.startContainer?.getBoundingClientRect()
        return (rect.top + rect.bottom) / 2
      }
    }
  }
}


export default ({
  id,
  commit,
  parent_id,
  author,
  title,
  body,
  upvotes,
  downvotes,
  config,
  userInteractions,
  setShowCritique,
  parentRef,
  submitSignal = false,
  setSubmitSignal = () => { },
  setCritiques = () => { },
  tempHighlight,
  setTempHighlight,
  setOffset,
  skipOffset = false,
  interval
}) => {
  const initialVoteState = userInteractions?.filter(v => v === "up" || v === "down")[0]
  const readOnly = !!body

  const [relevanceVote, setRelevanceVote] = React.useState(initialVoteState)
  const [content, setContent] = React.useState(body)
  const [frameHeight, setFrameHeight] = React.useState()
  const [offsetTop, setOffsetTop] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState(false)
  const titleRef = React.useRef()
  const navigate = useNavigate()
  const { user } = useUser()
  const isDesktop = useBreakpoint("md")

  const headerConfig = {
    "save": {
      description: "confirmar crítica",
      icons: PiCheck,
      hide: readOnly,
      onClick: () => submit()
    },
    "bookmark": {
      description: ["salvar crítica", "remover crítica dos salvos"],
      icons: [PiBookmarkSimple, PiBookmarkSimpleFill],
      initialValue: userInteractions?.includes("bookmark") || false,
      hide: !readOnly,
      onClick: () => submitVote(navigate, id, "bookmark")
    },
    "close": {
      description: "fechar crítica",
      icons: PiX,
      hide: !setShowCritique,
      onClick: () => { setShowCritique(false); setTempHighlight && setTempHighlight([]) }
    }
  }


  const getMetrics = () => {
    const removeOrAddVote = initialVoteState ? -(relevanceVote === "") : +(relevanceVote === "up" || relevanceVote === "down")
    const allVotes = upvotes + downvotes + removeOrAddVote
    return [
      `iniciado por ${author}`,
      allVotes ? `${toPercentageStr((upvotes + getUserVote(initialVoteState, relevanceVote)) / allVotes)} dos ${allVotes} votantes achou relevante` : "0 votos"
    ]
  }

  const submit = async () => {
    const title = titleRef?.current.textContent
    const [from, to] = interval

    if (!title || !content || !from || !to || !commit) {
      setError(true)
      return
    }

    if (!user) {
      navigate("/login")
      return
    }

    try {
      setIsLoading(true)
      const url = `${env.apiAddress}/contents`

      const res = await fetch(url, {
        method: "post",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.accessToken}` },
        body: JSON.stringify({ title, body: content, config: { from, to, commit }, parent_id })
      })


      if (res.ok) {
        const data = await res.json()
        setCritiques(prev => [...prev, data])
        setShowCritique(false)
      }
      else
        setError(true)
    }
    catch (err) {
      console.error(err)
    }
    finally {
      setIsLoading(false)
      setSubmitSignal(false)
    }
  }


  React.useEffect(() => {
    if (!skipOffset && frameHeight && interval !== undefined && isDesktop) {
      const y = getSelectionHeight() + window.scrollY - frameHeight - parentRef?.current.offsetTop

      if (Number.isFinite(y)) {
        setOffsetTop(y)
        setOffset && setOffset(y)
        !tempHighlight.length && window.scrollTo({ top: y, behavior: "smooth" })
      }
    }
  }, [frameHeight, interval])

  React.useEffect(() => {
    if (submitSignal)
      submit()
  }, [submitSignal])


  return (
    <Frame
      id={id}
      title={setTempHighlight ?
        <span
          className={JSON.stringify(tempHighlight) === JSON.stringify([config.from, config.to]) ? "active" : undefined}
          title="clique para marcar a crítica no texto"
          onClick={() => { setTempHighlight([config.from, config.to]) }}
        >
          {title}
        </span>
        :
        title
      }
      titleRef={titleRef}
      headerConfig={headerConfig}
      relevanceVote={relevanceVote}
      setRelevanceVote={setRelevanceVote}
      metrics={readOnly && getMetrics}
      hideVoteButtons={!readOnly}
      isCritique
      justify
      readOnly={readOnly}
      style={{ transform: isDesktop && !setOffset ? `translate(0,${offsetTop}px)` : undefined, width: isDesktop ? undefined : "100%" }}
      setHeight={setFrameHeight}
      error={error}
      setError={setError}
    >
      {isLoading ?
        <div className="spinner" />
        :
        <Editor
          initialContent={body}
          edit={!readOnly} // Setting this so that the read only chart can't be edited 
          reset={body}
          content={content}
          setContent={(text) => { setContent(text); setError(false) }}
          bubbleMenuShouldShow={!readOnly}
        />
      }
    </Frame>
  )
}