import React from "react"
import { Link, useNavigate, useLocation } from "react-router"

import { default as Editor } from "@/components/Editor"
import Frame from "@/components/primitives/Frame"
import Input from "@/components/primitives/Input"
import env from "@/assets/enviroment"
import useUser from "@/context/UserContext"
import Alert from "@/components/primitives/Alert"
import LoadingButton from "@/components/primitives/LoadingButton"
import { describe, validate } from "@/assets/validation"
import useToLogin from "@/hooks/useToLogin"

export default function Write() {
  const titleRef = React.useRef()
  const [body, setBody] = React.useState(localStorage.getItem("editorContent") || "")
  const [answer, setAnswer] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState(false)
  // Whether the title or body was empty when the error was raised; any edit clears `error`
  const [isIncomplete, setIsIncomplete] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState(false)
  const navigate = useNavigate()
  const toLogin = useToLogin()
  const { state } = useLocation()
  const { user } = useUser()

  const clearLocalStorage = () => {
    localStorage.removeItem("editorContent")
    localStorage.removeItem("postTitle")
  }

  const submit = async () => {
    const title = titleRef?.current.textContent.trim()
    setIsIncomplete(!title || !body)

    if (!title || !body || (state.config?.answers?.length !== 0 && !answer)) {
      setError(true)
      return
    }

    if (!user) {
      toLogin()
      return
    }

    const values = { title, body, config: { answer }, parent_id: state.id }
    const [invalid] = validate("post", values).errors
    if (invalid) {
      setError(true)
      setErrorMessage(describe(invalid).toLowerCase())
      return
    }

    try {
      setIsLoading(true)
      const url = `${env.apiAddress}/contents`

      const res = await fetch(url, {
        method: "post",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.accessToken}` },
        body: JSON.stringify(values)
      })

      const data = await res.json()

      if (res.status >= 400) {
        setErrorMessage(data.message.toLowerCase())
        return
      }

      clearLocalStorage()
      navigate(`/topics/${state.id}/posts/${data.id}`)
    }
    catch (err) {
      console.error(err)
    }
    finally {
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    document.title = `respondendo a "${state.title}" · colcom`
  }, [state.title])

  return (
    <div className="content write">
      <div className="topicName">respondendo ao tópico &quot;<Link to={`/topics/${state.id}`}>{state.title}</Link>&quot;</div>

      <Frame
        titleRef={titleRef}
        title={localStorage.getItem("postTitle") || ""}
        readOnly={false}
        hideVoteButtons
        saveInLocalStorage
        justify
        error={error && isIncomplete}
        setError={setError}
      >
        <Editor content={body} setContent={(text) => { setBody(text); setError(false) }} />
      </Frame>
      <Alert setter={setErrorMessage}>
        {errorMessage}
      </Alert>
      <div className="buttons">
        {state.config?.answers?.length !== 0 &&
          <fieldset className={(!answer && error) ? "error" : ""}>
            <legend>sua resposta</legend>
            {
              state.config.answers.map((option, index) => (
                <Input
                  id={option.toLowerCase()}
                  type="radio"
                  value={option}
                  label={option}
                  checked={answer === option}
                  onChange={e => setAnswer(e.target.value)}
                  key={`a${index}`}
                />
              ))
            }
          </fieldset>
        }
        {/* <button onClick={download}>salvar</button> */}
        <LoadingButton isLoading={isLoading} onClick={submit}>
          {isLoading ? "publicando..." : "publicar"}
        </LoadingButton>
      </div>
    </div>
  )
}