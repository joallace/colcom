import React from "react"
import { useParams } from 'react-router-dom'
import {
  PiBookmarkSimple,
  PiBookmarkSimpleFill,
  PiPencilSimpleFill,
  PiPencilSimple,
  PiGitBranch,
  PiHighlighterCircle,
  PiCheck,
  PiX
} from "react-icons/pi"

import TextEditor from "@/components/TextEditor"
import Frame from "@/components/Frame"
import env from "@/assets/enviroment"
import { toPercentageStr } from "@/assets/util"

const headerConfig = {
  // "critique": {
  //   description: "criticar techos do tópico",
  //   icons: PiHighlighterCircle,
  //   onClick: () => { }
  // },
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

function getSelectionHeight() {
  if (window.getSelection) {
    const selection = window.getSelection();
    if (selection.rangeCount) {
      const range = selection.getRangeAt(0).cloneRange();
      if (range.getBoundingClientRect) {
        // Sometimes, when selecting a whole paragraph, we can't get the selection rect
        // so we can just pick it from the starting container
        const rect = range.getBoundingClientRect().top ? range.getBoundingClientRect() : range.startContainer.getBoundingClientRect()
        return (rect.top + rect.bottom) / 2
      }
    }
  }
}


export default function Post() {
  const [content, setContent] = React.useState("")
  const [postData, setPostData] = React.useState({})
  const [showCritique, setShowCritique] = React.useState(false)
  const [critiqueTitle, setCritiqueTitle] = React.useState("")
  const [critiqueContent, setCritiqueContent] = React.useState("")
  const [critiqueHeight, setCritiqueHeight] = React.useState()
  const [critiqueYCoord, setCritiqueYCoord] = React.useState(0)
  const [isLoading, setIsLoading] = React.useState(false)
  const { pid } = useParams()

  const critiqueHeaderConfig = {
    "save": {
      description: "confirmar crítica",
      icons: PiCheck
    },
    "close": {
      description: "fechar crítica",
      icons: PiX,
      onClick: () => setShowCritique(false)
    },
  }

  const getMetrics = () => {
    const allVotes = postData.upvotes + postData.downvotes
    return [
      `iniciado por ${postData.author}`,
      allVotes ? `${toPercentageStr(postData.upvotes / allVotes)}% dos ${allVotes} votantes achou relevante` : "0 votos",
      `${allVotes} interações`
    ]
  }

  const getInitalVotes = () => {
    return {
      relevance: postData?.userInteractions?.filter(v => v === "up" || v === "down")[0]
    }
  }

  React.useEffect(() => {
    if (critiqueHeight && showCritique) {
      const y = getSelectionHeight() + window.scrollY - critiqueHeight

      setCritiqueYCoord(y)
      window.scrollTo({ top: y, behavior: "smooth" })
    }
  }, [critiqueHeight, showCritique])

  React.useEffect(() => {
    const fetchPost = async () => {
      try {
        setIsLoading(true)
        const url = `${env.apiAddress}/contents/${pid}`
        const res = await fetch(url, { method: "get" })
        const data = await res.json()

        if (data) {
          setPostData({ ...data, body: undefined })
          setContent(data.body)
        }
      }
      catch (err) {
        console.error(err)
      }
      finally {
        setIsLoading(false)
      }
    }

    fetchPost()
  }, [])

  return (
    <div className="post">
      {isLoading ?
        <div className="spinner" />
        :
        <>
          {/* <div className="topicName">respondendo ao tópico "<Link to={`/topics/${state.id}`}>{state.title}</Link>"</div> */}

          <Frame
            id={pid}
            title={postData.title}
            headerConfig={headerConfig}
            // initialVoteState={{ relevance }}
            metrics={getMetrics()}
            alongsideCritique={showCritique}
            showDefinitiveVoteButton
            justify
          >
            <TextEditor
              content={content}
              setContent={setContent}
              setShowCritique={setShowCritique}
            />
          </Frame>
          {showCritique &&
            <Frame
              title={critiqueTitle}
              setTitle={setCritiqueTitle}
              headerConfig={critiqueHeaderConfig}
              readOnly={false}
              isCritique
              justify
              // metrics
              style={{ transform: `translate(0,${critiqueYCoord}px)` }}
              setHeight={setCritiqueHeight}
            >
              <TextEditor content={critiqueContent} setContent={setCritiqueContent} />
            </Frame>
          }
        </>
      }
    </div>
  )
}