import React from "react"
import { useNavigate } from "react-router-dom"
import {
  PiCaretUpBold,
  PiCaretUpFill,
  PiCaretDownBold,
  PiCaretDownFill,
  PiDotsThreeVerticalBold,
} from "react-icons/pi"

import useScreenSize from "@/hooks/useScreenSize"
import { isEmptyObject } from "@tiptap/react"
import Input from "@/components/Input"
import env from "@/assets/enviroment"


export default function Topic({
  id,
  title,
  setTitle,
  metrics = [],
  headerConfig = {},
  initialRelevance = "",
  initialVote,
  saveInLocalStorage = false,
  readOnly = true,
  hideVoteButtons = false,
  showDefinitiveVoteButton = false,
  alongsideCritique = false,
  isCritique = false,
  justify = false,
  error = false,
  setHeight = () => { },
  children,
  ...remainingProps
}) {
  const [headerStatus, setHeaderStatus] = React.useState(
    Object.fromEntries(
      Object.entries(headerConfig)
        .map(([k, v]) => v.onStart && [k, v.onStart()])
        .filter((value) => value !== undefined)
    )
  )
  const isDesktop = useScreenSize()
  const [vote, setVote] = React.useState(false)
  const [relevance, setRelevance] = React.useState(initialRelevance)
  const topicRef = React.useRef()
  const titleRef = React.useRef()
  const navigate = useNavigate()


  const toggle = (str) => { setHeaderStatus({ ...headerStatus, [str]: !headerStatus[str] }) }

  const submitVote = async (type, colcoins = undefined) => {
    const token = localStorage.getItem("accessToken")
    if (!token) {
      navigate("/login")
      return
    }
    const url = `${env.apiAddress}/interactions`
    const body = JSON.stringify({
      content_id: id,
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


  React.useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = '32px';
      titleRef.current.style.height = `${titleRef.current.scrollHeight + 2}px`;
    }
  }, [title]);


  React.useEffect(() => {
    setHeight(topicRef.current.clientHeight || 0)
  }, [])


  return (
    <div className={`topic${alongsideCritique ? " original" : ""}${isCritique ? " critique" : ""}`} ref={topicRef} {...remainingProps}>
      <div className="header">
        <div className={`top bracket${error ? " error" : ""}`} />
        {!hideVoteButtons &&
          <div className={`vote-buttons${showDefinitiveVoteButton ? " withDefVote" : ""}`}>
            {relevance === "up" ?
              <PiCaretUpFill title="remover marcação" className="up" onClick={async () => { setRelevance(""); await submitVote(relevance) }} />
              :
              <PiCaretUpBold title="marcar como relevante" className="up" onClick={async () => { setRelevance("up"); await submitVote("up") }} />
            }
            {showDefinitiveVoteButton &&
              <Input
                className="center"
                title={vote ? "remover voto" : "votar nesta resposta"}
                type="radio"
                checked={vote}
                onClick={() => { setVote(!vote) }}
              />
            }
            {relevance === "down" ?
              <PiCaretDownFill title="remover marcação" className="down" onClick={async () => { submitVote(relevance); setRelevance("") }} />
              :
              <PiCaretDownBold title="marcar como não relevante" className="down" onClick={async () => { submitVote("down"); setRelevance("down") }} />
            }
          </div>
        }
        <h1 className="title">
          {readOnly ?
            title
            :
            <textarea
              placeholder="Qual é o título?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") { editor.chain().focus().run(); e.preventDefault() } }}
              onBlur={_ => saveInLocalStorage && localStorage.setItem("postTitle", title)}
              ref={titleRef}
            />
          }
        </h1>
        {!isEmptyObject(headerConfig) &&
          <div className="buttons">
            {isDesktop ?
              <>
                {Object.entries(headerConfig).map((([buttonName, buttonConfig]) => {
                  switch (headerStatus[buttonName]) {
                    case false:
                      return buttonConfig.icons[0]({
                        className: "icons",
                        title: buttonConfig.description[0],
                        onClick: () => { buttonConfig.onClick(); toggle(buttonName) }
                      })
                    case true:
                      return buttonConfig.icons[1]({
                        className: "icons",
                        title: buttonConfig.description[1],
                        onClick: () => { buttonConfig.onClick(); toggle(buttonName) }
                      })
                    case undefined:
                      return buttonConfig.icons({
                        className: "icons",
                        title: buttonConfig.description,
                        onClick: () => buttonConfig.onClick()
                      })
                  }
                }))}
              </>
              :
              <PiDotsThreeVerticalBold className="icons" />
            }
          </div>
        }
      </div>
      <div className="container">
        <div className={`bracket${error ? " error" : ""}`} />
        <div className={`body${justify ? " justify" : ""}`}>

          {children.constructor === Array ?
            children
            :
            React.cloneElement(children, { ...headerStatus, readOnly, saveInLocalStorage, alongsideCritique })
          }
          {metrics &&
            <ul className="metrics">
              {metrics.map(metric => (
                <li>{metric}</li>
              ))}
            </ul>
          }
        </div>
      </div>
    </div>
  )
}