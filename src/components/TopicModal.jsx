import React from "react"

import Modal from "@/components/Modal"
import Input from "@/components/Input"
import env from "@/assets/enviroment"

export default ({ isOpen, setIsOpen }) => {
  const [title, setTitle] = React.useState("")
  const [allowMultipleAnswers, setAllowMultipleAnswers] = React.useState(false)
  const [answers, setAnswers] = React.useState([])
  const [error, setError] = React.useState(false)
  const [globalError, setGlobalError] = React.useState(false)
  const [isLoading, setIsLoading] = React.useState(false)

  const handleAnswerChange = (index, value) => {
    setAnswers(answers.map((answer, i) => {
      if (index === i)
        return value
      else
        return answer
    }))
  }

  const submit = async () => {
    if (!title) {
      setError(true)
      return
    }

    try {
      setIsLoading(true)
      setGlobalError(false)
      const url = `${env.apiAddress}/contents`
      const token = localStorage.getItem("accessToken")

      const res = await fetch(url, {
        method: "post",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
        body: JSON.stringify({ title, config: { allowMultipleAnswers, answers } })
      })

      const data = await res.json()

      if (res.status >= 400) {
        setGlobalError(data.message.toLowerCase())
        return
      }

      console.log(data)
      setIsOpen(false)
    }
    catch (err) {
      setGlobalError("Não foi possível se conectar ao colcom. Por favor, verifique sua conexão.")
      console.error(err)
    }
    finally {
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    if (!answers.length)
      return

    const empty = answers.filter(v => v === "").length
    if (!empty)
      setAnswers([...answers, ""])
    else if (answers.length > 2 && empty >= 2 && answers[answers.length - 1] === "")
      setAnswers(answers.slice(0,-1))
  }, [answers])

  return (
    <Modal isOpen={isOpen} setIsOpen={setIsOpen} title="crie um tópico">
      <div className="topicModalBody">
        <Input
          label="título"
          value={title}
          onChange={e => { setTitle(e.target.value); setError(false) }}
          errorMessage={(error && !title) && "campo obrigatório!"}
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
          label="respostas limitadas"
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
                  label={`${answer ? "" : "adicionar "}resposta ${i + 1}`}
                  value={answer}
                  onChange={e => handleAnswerChange(i, e.target.value)}
                />
              ))
            }
          </div>
        }
      </div>
      <div className="footer">
        <button disabled={isLoading} onClick={submit}>
          {isLoading ? <><div className="button spinner"></div>publicando...</> : "publicar"}
        </button>
      </div>
    </Modal>
  )
}