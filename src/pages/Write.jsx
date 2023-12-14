import React from "react";

import TextEditor from "@/components/TextEditor";

export default function Write() {
  const [content, setContent] = React.useState("")

  return (
    <div className="content">
      <TextEditor setContent={setContent} />
      <div className="buttons">
        <button>Salvar</button>
        <button>Publicar</button>
      </div>
    </div>
  )
}