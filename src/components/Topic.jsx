import React from "react"
import {
  PiCaretUpBold,
  PiCaretDownBold,
  PiDotsThreeVerticalBold,
} from "react-icons/pi"

import useScreenSize from "@/hooks/useScreenSize"
import { isEmptyObject } from "@tiptap/react"


export default function Topic({
  title,
  setTitle,
  saveInLocalStorage = false,
  readOnly = true,
  hideVoteButtons = false,
  headerConfig = {},
  alongsideCritique,
  isCritique,
  metrics,
  children,
  error = false,
  setHeight = () => { },
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

  const topicRef = React.useRef()
  const titleRef = React.useRef()

  const toggle = (str) => { setHeaderStatus({ ...headerStatus, [str]: !headerStatus[str] }) }


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
          <div className="vote-buttons">
            <PiCaretUpBold title="relevante" className="up" />
            <PiCaretDownBold title="não relevante" className="down" />
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
        <div className="body">

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