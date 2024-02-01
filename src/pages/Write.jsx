import React from "react"
import { Link, useNavigate, useLocation } from "react-router-dom"

import TextEditor from "@/components/TextEditor"
import Topic from "@/components/Topic"
import Input from "@/components/Input"
import env from "@/assets/enviroment"

export default function Write() {
  const [title, setTitle] = React.useState(localStorage.getItem("postTitle") || "")
  const [body, setBody] = React.useState(localStorage.getItem("editorContent") || "")
  const [answer, setAnswer] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [globalError, setGlobalError] = React.useState(false)
  const navigate = useNavigate()
  const { state } = useLocation()

  const download = _ => {
    let element = document.createElement("a")
    element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(body))
    element.setAttribute("download", `${title}.html`)

    element.style.display = "none"
    document.body.appendChild(element)

    element.click()

    document.body.removeChild(element)
  }

  const submit = async () => {
    if (!title || !body || (state.config?.answers?.length !== 0 && !answer)) {
      setError(true)
      return
    }

    const token = localStorage.getItem("accessToken")
    if (!token) {
      navigate("/login")
      return
    }

    try {
      setIsLoading(true)
      const url = `${env.apiAddress}/contents`

      const res = await fetch(url, {
        method: "post",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ title, body, config: { answer }, parent_id: state.id })
      })

      const data = await res.json()

      if (res.status >= 400) {
        setGlobalError(data.message.toLowerCase())
        return
      }

      console.log(`/topics/${state.id}/posts/${data.id}`)
      navigate(`/topics/${state.id}/posts/${data.id}`)
    }
    catch (err) {
      console.error(err)
    }
    finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="content">
      <div className="topicName">respondendo ao tópico "<Link to={`/topics/${state.id}`}>{state.title}</Link>"</div>
      
      <Topic
        title={title}
        setTitle={(text) => { setTitle(text); setError(false) }}
        readOnly={false}
        hideVoteButtons
        saveInLocalStorage
        error={(!title || !body) && error}
      >
        <TextEditor content={body} setContent={(text) => { setBody(text); setError(false) }} />
      </Topic>
      {globalError &&
        <div className="globalError">{globalError}</div>
      }
      <div className="buttons">
        {state.config?.answers?.length !== 0 &&
          <fieldset className={(!answer && error) ? "error" : ""}>
            <legend>sua resposta</legend>
            {state.config.answers.map(option => (
              <Input
                id={option.toLowerCase()}
                type="radio"
                value={option}
                label={option}
                checked={answer === option}
                onChange={e => setAnswer(e.target.value)}
              />
            ))}
          </fieldset>
        }
        <button onClick={download}>salvar</button>
        <button disabled={isLoading} onClick={submit}>
          {isLoading ? <><div className="button spinner"></div>publicando...</> : "publicar"}
        </button>
      </div>
    </div>
  )
}