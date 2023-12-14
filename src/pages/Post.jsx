import React from "react";
import { useParams } from 'react-router-dom'

import TextEditor from "@/components/TextEditor";

export default function Post() {
  const [title, setTitle] = React.useState(localStorage.getItem("postTitle") || "")
  const [content, setContent] = React.useState(localStorage.getItem("editorContent") || "")
  const { id } = useParams()

  React.useEffect(()=>{
    console.log(content)
  }, [content])

  return (
    <div className="content">
      <TextEditor title={title} setTitle={setTitle} content={content} setContent={setContent} readOnly={true}/>
    </div>
  )
}