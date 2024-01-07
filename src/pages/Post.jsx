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
    description: ["sugerir edição no post", "finalizar edição"],
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
        // Sometimes, when selecting a whole paragraph, we can't get the selection rect
        // so we can just pick it from the starting container
        const rect = range.getBoundingClientRect().top? range.getBoundingClientRect() : range.startContainer.getBoundingClientRect()
        return (rect.top + rect.bottom)/2
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
  const [critiqueYCoord, setCritiqueYCoord] = React.useState(0)
  const { id } = useParams()

  const critiqueHeaderConfig = {
    "close": {
      description: "fechar crítica",
      icons: PiX,
      onClick: () => setShowCritique(false)
    },
  }

  React.useEffect(() => {
    if (critiqueHeight && showCritique){
      const y = getSelectionHeight() + window.scrollY - critiqueHeight

      setCritiqueYCoord(y)
      window.scrollTo({top: y, behavior:"smooth"})
    }
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
          style={{ transform: `translate(0,${critiqueYCoord}px)` }}
          setHeight={setCritiqueHeight}
        >
          <TextEditor content={critiqueContent} setContent={setCritiqueContent} />
        </Topic>
      }
    </div>
  )
}