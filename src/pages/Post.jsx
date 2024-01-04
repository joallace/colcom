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

export default function Post() {
  const title = localStorage.getItem("postTitle") || ""
  const [content, setContent] = React.useState(localStorage.getItem("editorContent") || "")
  const [showCritique, setShowCritique] = React.useState(false)
  const [critiqueTitle, setCritiqueTitle] = React.useState("")
  const [critiqueContent, setCritiqueContent] = React.useState("")
  const { id } = useParams()

  const critiqueHeaderConfig = {
    "close": {
      description: "fechar crítica",
      icons: PiX,
      onClick: () => setShowCritique(false)
    },
  }
  

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
        >
          <TextEditor content={critiqueContent} setContent={setCritiqueContent} />
        </Topic>
      }
    </div>
  )
}