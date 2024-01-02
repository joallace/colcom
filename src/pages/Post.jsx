import React from "react";
import { useParams } from 'react-router-dom'

import TextEditor from "@/components/TextEditor";
import Topic from "@/components/Topic";

export default function Post() {
  const [title, setTitle] = React.useState(localStorage.getItem("postTitle") || "")
  const [content, setContent] = React.useState(localStorage.getItem("editorContent") || "")
  const { id } = useParams()

  return (
    <div className="content">
      <Topic title={title}>
        <TextEditor title={title} setTitle={setTitle} content={content} setContent={setContent} readOnly={true} />
      </Topic>
    </div>
  )
}