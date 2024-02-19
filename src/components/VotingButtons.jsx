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
export default ({
  id,
  relevanceVote,
  setRelevanceVote,
  definitiveVote,
  setDefinitiveVote,
  showDefinitiveVoteButton = false
}) => {
  const [isLoading, setIsLoading] = React.useState(false)
  const navigate = useNavigate()

  const voteClick = async (type, clear) => {
    setIsLoading(true)
    setRelevanceVote(clear ? "" : type)
    await submitVote(navigate, id, type)
    setIsLoading(false)
  }

  const defVoteClick = async () => {
    setIsLoading(true)
    setDefinitiveVote(!definitiveVote)
    await submitVote(navigate, id, "vote")
    setIsLoading(false)
  }


  return (
    <div className={`vote-buttons${showDefinitiveVoteButton ? " withDefVote" : ""}`}>
      {relevanceVote === "up" ?
        <PiCaretUpFill
          title="remover marcação"
          className="up"
          onClick={() => !isLoading && voteClick("up", true)}
          style={{ cursor: isLoading ? "default" : "pointer" }}
        />
        :
        <PiCaretUpBold
          title="marcar como relevante"
          className="up"
          onClick={() => !isLoading && voteClick("up", false)}
          style={{ cursor: isLoading ? "default" : "pointer" }}
        />
      }
      {showDefinitiveVoteButton &&
        <Input
          className="center"
          title={definitiveVote ? "remover voto" : "votar nesta resposta"}
          type="radio"
          checked={definitiveVote}
          onClick={() => !isLoading && defVoteClick()}
          style={{ cursor: isLoading ? "default" : "pointer" }}
        />
      }
      {relevanceVote === "down" ?
        <PiCaretDownFill
          title="remover marcação"
          className="down"
          onClick={() => !isLoading && voteClick("down", true)}
          style={{ cursor: isLoading ? "default" : "pointer" }}
        />
        :
        <PiCaretDownBold
          title="marcar como não relevante"
          className="down"
          onClick={() => !isLoading && voteClick("down", false)}
          style={{ cursor: isLoading ? "default" : "pointer" }}
        />
      }
    </div>
  )
}