import React from "react"
import { useParams } from 'react-router-dom'
import {
  PiBookmarkSimple,
  PiBookmarkSimpleFill,
  PiPencilSimpleFill,
  PiPencilSimple,
  PiGitBranch
} from "react-icons/pi"

import TextEditor from "@/components/TextEditor"
import Topic from "@/components/Topic"

const headerConfig = {
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
  const { id } = useParams()

  return (
    <div className="content">
      <Topic title={title} headerConfig={headerConfig} metrics>
        <TextEditor content={content} setContent={setContent} readOnly={true} />
      </Topic>
    </div>
  )
}