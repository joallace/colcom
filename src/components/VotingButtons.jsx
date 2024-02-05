import React from "react"
import { useNavigate } from "react-router-dom"
import {
  PiCaretUpBold,
  PiCaretUpFill,
  PiCaretDownBold,
  PiCaretDownFill
} from "react-icons/pi"

import Input from "@/components/Input"
import env from "@/assets/enviroment"

export const submitVote = async (navigate, content_id, type, colcoins = undefined) => {
  const token = localStorage.getItem("accessToken")
  if (!token) {
    navigate("/login")
    return
  }
  const url = `${env.apiAddress}/interactions`
  const body = JSON.stringify({
    content_id,
    type,
    colcoins
  })

  const res = await fetch(url, {
    method: "post",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body
  })

  if (res.status >= 400) {
    console.error(res)
    return
  }
}
export default ({ id, initialState = { vote: false, relevance: "" }, showDefinitiveVoteButton = false, }) => {
  const [definitiveVote, setDefinitiveVote] = React.useState(initialState.vote)
  const [relevanceVote, setRelevance] = React.useState(initialState.relevance)
  const [isLoading, setIsLoading] = React.useState(false)
  const navigate = useNavigate()

  const voteClick = async (clear) => {
    setIsLoading(true)
    setRelevance(clear ? "" : relevanceVote)
    await submitVote(navigate, id, relevanceVote)
    setIsLoading(false)
  }


  return (
    <div className={`vote-buttons${showDefinitiveVoteButton ? " withDefVote" : ""}`}>
      {relevanceVote === "up" ?
        <PiCaretUpFill
          title="remover marcação"
          className="up"
          onClick={() => !isLoading && voteClick(true)}
        />
        :
        <PiCaretUpBold
          title="marcar como relevante"
          className="up"
          onClick={() => !isLoading && voteClick(false)}
        />
      }
      {showDefinitiveVoteButton &&
        <Input
          className="center"
          title={definitiveVote ? "remover voto" : "votar nesta resposta"}
          type="radio"
          checked={definitiveVote}
          onClick={() => { setDefinitiveVote(!definitiveVote) }}
        />
      }
      {relevanceVote === "down" ?
        <PiCaretDownFill
          title="remover marcação"
          className="down"
          onClick={() => !isLoading && voteClick(true)}
        />
        :
        <PiCaretDownBold
          title="marcar como não relevante"
          className="down"
          onClick={() => !isLoading && voteClick(false)}
        />
      }
    </div>
  )
}