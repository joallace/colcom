import React from "react"
import { useNavigate } from 'react-router-dom'
import {
  PiBookmarkSimple,
  PiBookmarkSimpleFill,
  PiCheck,
  PiX
} from "react-icons/pi"

import TextEditor from "@/components/TextEditor"
import Frame from "@/components/Frame"
import useBreakpoint from "@/hooks/useBreakpoint"
import env from "@/assets/enviroment"


function getSelectionHeight() {
  if (window.getSelection) {
    const selection = window.getSelection()
    if (selection.rangeCount) {
      const range = selection.getRangeAt(0).cloneRange()
      if (range.getBoundingClientRect) {
        // Sometimes, when selecting a whole paragraph, we can't get the selection rect
        // so we can just pick it from the starting container
        const rect = range.getBoundingClientRect().top ? range.getBoundingClientRect() : range.startContainer.getBoundingClientRect()
        return (rect.top + rect.bottom) / 2
      }
    }
  }
}


export default ({
  id,
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
  interval = []
}) => {
  const initialVoteState = userInteractions?.filter(v => v === "up" || v === "down")[0]
  const readOnly = !!body
  
  const [relevanceVote, setRelevanceVote] = React.useState(initialVoteState)
  const [content, setContent] = React.useState(body)
  const [frameHeight, setFrameHeight] = React.useState()
  const [offsetTop, setOffsetTop] = React.useState(0)
  const titleRef = React.useRef()
  const navigate = useNavigate()
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
      onClick: () => setShowCritique(false)
    }
  }


  const getMetrics = () => {
    const removeOrAddVote = initialVoteState ? -(relevanceVote === "") : +(relevanceVote === "up" || relevanceVote === "down")
    const allVotes = upvotes + downvotes + removeOrAddVote
    return [
      `iniciado por ${author}`,
      allVotes ? `${toPercentageStr(upvotes + updateVoteMetric() / allVotes)} dos ${allVotes} votantes achou relevante` : "0 votos"
    ]
  }

  const submit = async () => {
    const title = critiqueTitleRef?.current.textContent
    const commit = postData.history[config.commit].commit
    const [from, to] = interval

    if (!title || !content || !from || !to || !commit) {
      setError(true)
      return
    }

    const token = localStorage.getItem("accessToken")
    if (!token) {
      navigate("/login")
      return
    }

    try {
      const url = `${env.apiAddress}/contents`

      const res = await fetch(url, {
        method: "post",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ title, body: content, config: { from, to, commit }, parent_id })
      })

      const data = await res.json()

      if (res.status >= 400) {
        setGlobalError(data.message.toLowerCase())
        return
      }
    }
    catch (err) {
      console.error(err)
    }
  }


  React.useEffect(() => {
    if (frameHeight && interval) {
      const y = getSelectionHeight() + window.scrollY - frameHeight - parentRef?.current.offsetTop

      setOffsetTop(y)
      window.scrollTo({ top: y, behavior: "smooth" })
    }
  }, [frameHeight, interval])


  return (
    <Frame
      id={id}
      title={title}
      titleRef={titleRef}
      headerConfig={headerConfig}
      relevanceVote={relevanceVote}
      setRelevanceVote={setRelevanceVote}
      metrics={readOnly && getMetrics}
      hideVoteButtons={!readOnly}
      isCritique
      justify
      readOnly={readOnly}
      style={{ transform: isDesktop ? `translate(0,${offsetTop}px)` : undefined, width: isDesktop ? undefined : "100%" }}
      setHeight={setFrameHeight}
    >
      <TextEditor initialContent={body} reset={body} content={content} setContent={setContent} />
    </Frame>
  )
}