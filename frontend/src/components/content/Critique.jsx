import React from "react"
import { useNavigate, Link } from 'react-router'
import {
  PiBookmarkSimple,
  PiBookmarkSimpleFill,
  PiCheck,
  PiX
} from "react-icons/pi"

import { default as Editor } from "@/components/Editor"
import Frame from "@/components/primitives/Frame"
import Spinner from "@/components/primitives/Spinner"
import Alert from "@/components/primitives/Alert"
import { submitVote } from "@/assets/interactions"
import { Author, Relevance } from "@/components/content/Metrics"
import useBreakpoint from "@/hooks/useBreakpoint"
import env from "@/assets/enviroment"
import useUser from "@/context/UserContext"
import { describe, validate } from "@/assets/validation"
import { readableText } from "@/assets/textIndex"


export default function Critique({
  id,
  commit,
  parent_id,
  author,
  author_avatar,
  title,
  body,
  upvotes,
  downvotes,
  config,
  userInteractions,
  setShowCritique,
  submitSignal = false,
  setSubmitSignal = () => { },
  setCritiques = () => { },
  tempHighlight,
  setTempHighlight,
  interval,
  anchor,
  isInGroup,
  quote
}) {
  const initialVoteState = userInteractions?.filter(v => v === "up" || v === "down")[0]
  const readOnly = !!body

  const [relevanceVote, setRelevanceVote] = React.useState(initialVoteState)
  const [content, setContent] = React.useState(body)
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState("")
  const titleRef = React.useRef()
  const navigate = useNavigate()
  const { user } = useUser()
  const isDesktop = useBreakpoint("md")
  // Where the critique lands on the version being read; none when its passage was removed
  const range = anchor && anchor.match !== "removed" ? [anchor.from, anchor.to] : undefined
  const isFromEarlierVersion = readOnly && config?.commit && config.commit !== commit

  const originMessage = {
    exact: "Crítica feita em uma versão anterior do post.",
    fuzzy: "O trecho criticado foi alterado desde esta crítica.",
    removed: "O trecho criticado foi removido do post."
  }

  const headerConfig = {
    "save": {
      description: "confirmar crítica",
      icons: PiCheck,
      hide: readOnly,
      onClick: () => submit()
    },
    "bookmark": {
      description: ["salvar crítica", "remover dos salvos"],
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
    return [
      <Author key="author" name={author} avatar={author_avatar} />,
      <Relevance key="relevance" {...{ initialVoteState, relevanceVote, upvotes, downvotes }} />
    ]
  }

  const submit = async () => {
    const title = titleRef?.current.textContent.trim()
    const [from, to] = interval

    // A chart at the very start of the post is at position 0
    if (!title || !content || !Number.isInteger(from) || !to || !commit || !quote) {
      setError(true)
      return
    }

    if (!user) {
      navigate("/login")
      return
    }

    const values = { title, body: content, config: { from, to, commit, quote }, parent_id }
    const [invalid] = validate("critique", values).errors
    if (invalid) {
      setError(true)
      setErrorMessage(describe(invalid).toLowerCase())
      setSubmitSignal(false)
      return
    }

    try {
      setIsLoading(true)
      setErrorMessage("")
      const url = `${env.apiAddress}/contents`

      const res = await fetch(url, {
        method: "post",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.accessToken}` },
        body: JSON.stringify(values)
      })

      const data = await res.json()

      if (res.ok) {
        setCritiques(prev => [...prev, { ...data, author_avatar: user.avatar }])
        setShowCritique(false)
      }
      else {
        setError(true)
        setErrorMessage(data.message?.toLowerCase())
      }
    }
    catch (err) {
      console.error(err)
    }
    finally {
      setIsLoading(false)
      setSubmitSignal(false)
    }
  }


  const onSubmitSignal = React.useEffectEvent(() => submit())

  React.useEffect(() => {
    if (submitSignal)
      onSubmitSignal()
  }, [submitSignal])

  // Marks the critique's passage when it opens. `range` is rebuilt on every render, so it's read
  // through an effect event: as a dependency, setting the highlight would re-run the effect forever
  const highlightPassage = React.useEffectEvent(() => {
    if (range)
      setTempHighlight(range)
  })

  React.useEffect(() => {
    if (setTempHighlight)
      highlightPassage()
  }, [setTempHighlight])

  return (
    <Frame
      id={id}
      title={isInGroup ?
        <span
          className={range && JSON.stringify(tempHighlight) === JSON.stringify(range) ? "active" : undefined}
          title={range ? "clique para marcar a crítica no texto" : undefined}
          onClick={() => { range && setTempHighlight(range) }}
        >
          {title}
        </span>
        :
        readOnly ?
          <Link to={`?commit=${config.commit}`}>{title}</Link>
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
      style={{ width: isDesktop ? undefined : "100%" }}
      error={error}
      setError={setError}
    >
      {isFromEarlierVersion &&
        <div className="critiqueOrigin">
          <span>{originMessage[anchor?.match ?? "removed"]}</span>
          {anchor?.match !== "exact" && config.quote && <blockquote>{readableText(config.quote.exact)}</blockquote>}
          <Link to={`?commit=${config.commit}`} onClick={() => setShowCritique && setShowCritique(false)}>
            ver a versão criticada
          </Link>
        </div>
      }

      {isLoading ?
        <Spinner />
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
      <Alert setter={setErrorMessage}>
        {errorMessage}
      </Alert>
    </Frame>
  )
}
