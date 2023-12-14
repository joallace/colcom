import React from "react";

import TextEditor from "@/components/TextEditor";

export default function Write() {
  const [title, setTitle] = React.useState(localStorage.getItem("postTitle") || "")
  const [content, setContent] = React.useState(localStorage.getItem("editorContent") || "")

  const download = _ => {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', `${title}.html`);
  
    element.style.display = 'none';
    document.body.appendChild(element);
  
    element.click();
  
    document.body.removeChild(element);
  }

  return (
    <div className="content">
      <TextEditor title={title} setTitle={setTitle} content={content} setContent={setContent}/>
      <div className="buttons">
        <button onClick={download}>Salvar</button>
        <button>Publicar</button>
      </div>
    </div>
  )
}