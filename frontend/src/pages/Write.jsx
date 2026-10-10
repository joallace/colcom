import React from "react"
import { Link, useNavigate, useLocation, useSearchParams } from "react-router"

import { default as Editor } from "@/components/Editor"
import Frame from "@/components/primitives/Frame"
import Input from "@/components/primitives/Input"
import api, { ApiError } from "@/assets/api"
import useUser from "@/context/UserContext"
import Alert from "@/components/primitives/Alert"
import LoadingButton from "@/components/primitives/LoadingButton"
import NoResponse from "@/components/primitives/NoResponse"
import Spinner from "@/components/primitives/Spinner"
import { describe, validate } from "@/assets/validation"
import { clearDraft, loadDraft, saveDraft } from "@/assets/drafts"
import useApiResource from "@/hooks/useApiResource"
import useToLogin from "@/hooks/useToLogin"

const isId = value => /^[1-9]\d*$/.test(value ?? "")

// Answering a topic: /write?topic=<id>. The topic comes with the router state when the topic's
// page opened this one, and is fetched otherwise (a link, a reload)
export default function Write() {
  const [searchParams] = useSearchParams()
  const { state } = useLocation()
  const topicId = searchParams.get("topic")
  const valid = isId(topicId)
  const fromState = valid && state?.id != null && String(state.id) === topicId && state.config ? state : undefined
  // The topic fetched by id: null when there's none (or it isn't a topic), undefined while loading
  const fetched = useApiResource(valid && !fromState ? `/contents/${topicId}?omit_body` : null)
  const { data, error } = fetched
  const fetchedTopic = React.useMemo(() => data?.type === "topic" ?
    { id: data.id, title: data.title, config: data.config ?? {} }
    :
    (data || error) ? null : undefined,
  [data, error])
  const topic = fromState ?? fetchedTopic

  React.useEffect(() => {
    if (!valid || topic === null)
      document.title = "tópico não encontrado · colcom"
  }, [valid, topic])

  if (!valid || topic === null)
    return (
      <div className="centered content">
        <NoResponse>
          {valid ? "tópico não encontrado." : "nenhum tópico escolhido para responder."}
          {" "}<Link to="/">ver os tópicos</Link>
        </NoResponse>
      </div>
    )

  if (!topic)
    return <div className="centered content"><Spinner /></div>

  // A new form per topic, so one topic's draft never carries over into another's
  return <WriteForm key={topicId} topic={topic} />
}

function WriteForm({ topic }) {
  const titleRef = React.useRef()
  const [draft] = React.useState(() => loadDraft(topic.id))
  const [body, setBody] = React.useState(draft.body)
  const [answer, setAnswer] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState(false)
  // Whether the title or body was empty when the error was raised; any edit clears `error`
  const [isIncomplete, setIsIncomplete] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState(false)
  const navigate = useNavigate()
  const toLogin = useToLogin()
  const { user } = useUser()
  const answers = topic.config?.answers ?? []

  const submit = async () => {
    const title = titleRef?.current.textContent.trim()
    setIsIncomplete(!title || !body)

    if (!title || !body || (answers.length !== 0 && !answer)) {
      setError(true)
      return
    }

    if (!user) {
      toLogin()
      return
    }

    const values = { title, body, config: { answer }, parent_id: Number(topic.id) }
    const [invalid] = validate("post", values).errors
    if (invalid) {
      setError(true)
      setErrorMessage(describe(invalid).toLowerCase())
      return
    }

    try {
      setIsLoading(true)
      const data = await api.post("/contents", values)
      clearDraft(topic.id)
      navigate(`/topics/${topic.id}/posts/${data.id}`)
    }
    catch (err) {
      if (err instanceof ApiError)
        setErrorMessage(err.message.toLowerCase())
      else
        console.error(err)
    }
    finally {
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    document.title = `respondendo a "${topic.title}" · colcom`
  }, [topic.title])

  return (
    <div className="content write">
      <div className="topicName">respondendo ao tópico &quot;<Link to={`/topics/${topic.id}`}>{topic.title}</Link>&quot;</div>

      <Frame
        titleRef={titleRef}
        title={draft.title}
        readOnly={false}
        hideVoteButtons
        onTitleBlur={title => saveDraft(topic.id, "title", title)}
        justify
        error={error && isIncomplete}
        setError={setError}
      >
        <Editor content={body} setContent={(text) => { setBody(text); saveDraft(topic.id, "body", text); setError(false) }} />
      </Frame>
      <Alert setter={setErrorMessage}>
        {errorMessage}
      </Alert>
      <div className="buttons">
        {answers.length !== 0 &&
          <fieldset className={(!answer && error) ? "error" : ""}>
            <legend>sua resposta</legend>
            {
              answers.map((option, index) => (
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
        <LoadingButton isLoading={isLoading} onClick={submit}>
          {isLoading ? "publicando..." : "publicar"}
        </LoadingButton>
      </div>
    </div>
  )
}
