import React from "react"
import { Link, useLocation } from "react-router-dom"

import TextEditor from "@/components/TextEditor"
import Topic from "@/components/Topic"
import Input from "@/components/Input"

export default function Write() {
  const [title, setTitle] = React.useState(localStorage.getItem("postTitle") || "")
  const [content, setContent] = React.useState(localStorage.getItem("editorContent") || "")
  const [answer, setAnswer] = React.useState("")
  const { state } = useLocation()

  const download = _ => {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(content));
    element.setAttribute('download', `${title}.html`);

    element.style.display = 'none';
    document.body.appendChild(element);

    element.click();

    document.body.removeChild(element);
  }

  const submit = () => {

  }
  
  return (
    <div className="content">
      <div className="topicName">respondendo ao tópico "<Link to={`/topics/${state.id}`}>{state.title}</Link>"</div>
      
      <Topic
        title={title}
        setTitle={setTitle}
        readOnly={false}
        hideVoteButtons
        saveInLocalStorage
      >
        <TextEditor content={content} setContent={setContent} />
      </Topic>
      <div className="buttons">
      <fieldset>
        <legend>sua resposta</legend>
        {state.config.answers.map(option => (
          <Input
            id={option.toLowerCase()}
            type="radio"
            value={option}
            label={option}
            checked={answer === option}
            onChange={e=>setAnswer(e.target.value)}
          />
        ))}
      </fieldset>
        <button onClick={download}>Salvar</button>
        <button>Publicar</button>
      </div>
    </div>
  )
}