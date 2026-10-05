import React from "react"
import { useNavigate } from "react-router"

import Modal from "@/components/primitives/Modal"
import Input from "@/components/primitives/Input"
import LoadingButton from "@/components/primitives/LoadingButton"
import Alert from "@/components/primitives/Alert"
import env from "@/assets/enviroment"
import { formErrors, limits, responseErrors } from "@/assets/validation"
import useUser from "@/context/UserContext"

export default function TopicModal({ isOpen, setIsOpen }) {
  const [title, setTitle] = React.useState("")
  const [allowMultipleAnswers, setAllowMultipleAnswers] = React.useState(false)
  const [answers, setAnswers] = React.useState([])
  // A message for each invalid field: "title", or "answer.<index>" for an answer's input
  const [errors, setErrors] = React.useState({})
  const [errorMessage, setErrorMessage] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)
  const navigate = useNavigate()
  const { user } = useUser()

  // There's always one empty input for the next answer, and extra empty ones at the end are dropped
  const withNextInput = list => {
    const result = list.includes("") ? [...list] : [...list, ""]

    while (result.length > 2 && result.at(-1) === "" && result.filter(v => v === "").length >= 2)
      result.pop()

    return result
  }

  const handleAnswerChange = (index, value) => {
    setAnswers(withNextInput(answers.map((answer, i) => {
      if (index === i)
        return value
      else
        return answer
    })))
  }

  // The form keeps an empty input for the next answer, which isn't sent
  const filledAnswers = () => answers.map((answer, index) => [index, answer.trim()]).filter(([, answer]) => answer !== "")

  // Shows each error next to its input; those about the answers as a whole go above them
  const showErrors = (found, filled) => {
    const byInput = {}
    let general = ""

    for (const [key, message] of Object.entries(found)) {
      const answer = key.match(/^config\.answers\.(\d+)$/)
      if (key === "title")
        byInput.title = message
      else if (answer && filled[answer[1]])
        byInput[`answer.${filled[answer[1]][0]}`] = message
      else
        general ||= key === "config.answers" ? `respostas: ${message}` : message
    }

    setErrors(byInput)
    setErrorMessage(general)
  }

  const clearError = key => setErrors(prev => ({ ...prev, [key]: undefined }))

  const submit = async () => {
    const filled = filledAnswers()
    const values = { title: title.trim(), config: { allowMultipleAnswers, answers: filled.map(([, answer]) => answer) } }
    const found = formErrors("topic", values)

    if (Object.keys(found).length) {
      showErrors(found, filled)
      return
    }

    try {
      setIsLoading(true)
      setErrorMessage("")
      const url = `${env.apiAddress}/contents`

      const res = await fetch(url, {
        method: "post",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.accessToken}` },
        body: JSON.stringify(values)
      })

      const data = await res.json()

      if (res.status >= 400) {
        if (data.errors)
          showErrors(responseErrors(data), filled)
        else
          setErrorMessage(data.message.toLowerCase())
        return
      }
      setIsOpen(false)

      if(data?.id)
        navigate(`/topics/${data.id}`)
    }
    catch (err) {
      setErrorMessage("Não foi possível se conectar ao colcom. Por favor, verifique sua conexão.")
      console.error(err)
    }
    finally {
      setIsLoading(false)
    }
  }

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title="crie um tópico">
      <div className="topicModalBody">
        <Alert setter={setErrorMessage}>
          {errorMessage}
        </Alert>
        <Input
          label="título"
          value={title}
          maxLength={limits.title.max}
          onChange={e => { setTitle(e.target.value); clearError("title") }}
          errorMessage={errors.title && `${errors.title}!`}
        />
        <Input
          id="allowMultipleAnswers"
          label="permitir múltiplas respostas por usuário"
          type="checkbox"
          checked={allowMultipleAnswers}
          onChange={() => setAllowMultipleAnswers(!allowMultipleAnswers)}
        />
        <Input
          id="limitedAnswers"
          label="definir opções de resposta"
          type="checkbox"
          checked={answers.length !== 0}
          onChange={() => {
            answers.length ?
              setAnswers([])
              :
              setAnswers(["", ""])
          }}
        />
        {answers.length !== 0 &&
          <div className="answers">
            {
              answers.map((answer, i) => (
                <Input
                  key={`answer-${i}`}
                  label={`${answer ? "" : "adicionar "}resposta ${i + 1}`}
                  value={answer}
                  maxLength={limits.answer.max}
                  onChange={e => { handleAnswerChange(i, e.target.value); clearError(`answer.${i}`) }}
                  errorMessage={errors[`answer.${i}`] && `${errors[`answer.${i}`]}!`}
                />
              ))
            }
          </div>
        }
      </div>
      <div className="footer">
        <LoadingButton isLoading={isLoading} onClick={submit}>
          {isLoading ? "publicando..." : "publicar"}
        </LoadingButton>
      </div>
    </Modal>
  )
}