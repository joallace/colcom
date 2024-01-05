import React from "react"
import { useParams } from 'react-router-dom'
import {
  PiBookmarkSimple,
  PiBookmarkSimpleFill,
  PiPencilSimpleFill,
  PiPencilSimple,
  PiGitBranch,
  PiHighlighterCircle,
  PiX
} from "react-icons/pi"

import TextEditor from "@/components/TextEditor"
import Topic from "@/components/Topic"

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
    description: ["editar tópico", "finalizar edição"],
    icons: [PiPencilSimple, PiPencilSimpleFill],
    onStart: () => false,
    onClick: () => { }
  },
  "bookmark": {
    description: ["salvar tópico", "remover tópico dos salvos"],
    icons: [PiBookmarkSimple, PiBookmarkSimpleFill],
    onStart: () => false,
    onClick: () => { }
  }
}

function getSelectionHeight() {
  if (window.getSelection) {
    const selection = window.getSelection();
    if (selection.rangeCount) {
      const range = selection.getRangeAt(0).cloneRange();
      if (range.getBoundingClientRect) {
        return (range.getBoundingClientRect().top + range.getBoundingClientRect().bottom)/2
      }
    }
  }
}


export default function Post() {
  const title = localStorage.getItem("postTitle") || ""
  const [content, setContent] = React.useState(localStorage.getItem("editorContent") || "")
  const [showCritique, setShowCritique] = React.useState(false)
  const [critiqueTitle, setCritiqueTitle] = React.useState("")
  const [critiqueContent, setCritiqueContent] = React.useState("")
  const [critiqueHeight, setCritiqueHeight] = React.useState()
  const [selectionHeight, setSelectionHeight] = React.useState(0)
  const [scrollHeight, setScrollHeight] = React.useState(0)
  const { id } = useParams()


  const critiqueHeaderConfig = {
    "close": {
      description: "fechar crítica",
      icons: PiX,
      onClick: () => setShowCritique(false)
    },
  }

  React.useEffect(() => {
    const handleScroll = () => {
      setScrollHeight(window.scrollY)
    }

    window.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      window.removeEventListener('scroll', handleScroll)
    }
  }, [])

  React.useEffect(() => {
    if (critiqueHeight)
      setSelectionHeight(getSelectionHeight() + scrollHeight - critiqueHeight)
  }, [critiqueHeight, showCritique])

  return (
    <div className="post">
      <Topic
        title={title}
        headerConfig={headerConfig}
        metrics
        alongsideCritique={showCritique}
      >
        <TextEditor
          content={content}
          setContent={setContent}
          setShowCritique={setShowCritique}
        />
      </Topic>
      {showCritique &&
        <Topic
          title={critiqueTitle}
          setTitle={setCritiqueTitle}
          headerConfig={critiqueHeaderConfig}
          readOnly={false}
          isCritique
          metrics
          style={{ transform: `translate(0,${selectionHeight}px)` }}
          setHeight={setCritiqueHeight}
        >
          <TextEditor content={critiqueContent} setContent={setCritiqueContent} />
        </Topic>
      }
    </div>
  )
}