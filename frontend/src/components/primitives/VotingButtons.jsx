import React from "react"
import { useNavigate } from "react-router"
import {
  PiCaretUpBold,
  PiCaretUpFill,
  PiCaretDownBold,
  PiCaretDownFill
} from "react-icons/pi"

import Input from "@/components/primitives/Input"
import { submitVote } from "@/assets/interactions"

export default function VotingButtons({
  id,
  relevanceVote,
  setRelevanceVote,
  definitiveVote,
  setDefinitiveVote,
  definitiveVoteType,
  showDefinitiveVoteButton = false
}) {
  const [isLoading, setIsLoading] = React.useState(false)
  const [hovering, setHovering] = React.useState("")
  const navigate = useNavigate()

  const voteClick = async (type) => {
    setIsLoading(true)
    setRelevanceVote(type === relevanceVote ? "" : type)
    await submitVote(navigate, id, type)
    setIsLoading(false)
  }

  const defVoteClick = async () => {
    setIsLoading(true)

    if (definitiveVoteType === "vote")
      setDefinitiveVote(!definitiveVote)
    else
      if (definitiveVote === id)
        setDefinitiveVote(null)
      else
        setDefinitiveVote(id)

    await submitVote(navigate, id, definitiveVoteType)
    setIsLoading(false)
  }


  return (
    <div className={`votingButtons${showDefinitiveVoteButton ? " withDefVote" : ""}`}>
      <div
        className="up"
        onMouseEnter={() => { setHovering("up") }}
        onMouseLeave={() => { setHovering("") }}
        onClick={() => !isLoading && voteClick("up")}
        style={{ cursor: isLoading ? "default" : "pointer" }}
      >
        {(hovering === "up" || relevanceVote === "up") ?
          <PiCaretUpFill
            title={relevanceVote === "up" ? "remover marcação" : "marcar como relevante"}
          />
          :
          <PiCaretUpBold
            title="marcar como relevante"
          />
        }
      </div>

      {showDefinitiveVoteButton &&
        <Input
          className="center"
          title={definitiveVote ? "remover voto" : ((definitiveVoteType === "vote") ? "votar nesta resposta" : "promover este tópico")}
          type="radio"
          checked={definitiveVoteType === "vote" ? definitiveVote : (definitiveVote === id)}
          onClick={() => !isLoading && defVoteClick()}
          style={{ cursor: isLoading ? "default" : "pointer" }}
        />
      }
      <div
        className="down"
        onMouseEnter={() => { setHovering("down") }}
        onMouseLeave={() => { setHovering("") }}
        onClick={() => !isLoading && voteClick("down")}
        style={{ cursor: isLoading ? "default" : "pointer" }}
      >
        {(relevanceVote === "down" || hovering === "down") ?
          <PiCaretDownFill
            title={relevanceVote === "down" ? "remover marcação" : "marcar como não relevante"}
          />
          :
          <PiCaretDownBold
            title="marcar como relevante"
          />
        }
      </div>
    </div>
  )
}