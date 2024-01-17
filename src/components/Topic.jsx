import React from "react"
import {
  PiCaretUpBold,
  PiCaretDownBold,
  PiDotsThreeVerticalBold,
} from "react-icons/pi"

import useScreenSize from "@/hooks/useScreenSize"


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
  const [bracketMargin, setBracketMargin] = React.useState(0)
  const isDesktop = useScreenSize()

  const topicRef = React.useRef()
  const headerRef = React.useRef()
  const titleRef = React.useRef()

  const toggle = (str) => { setHeaderStatus({ ...headerStatus, [str]: !headerStatus[str] }) }

  React.useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = '32px';
      titleRef.current.style.height = `${titleRef.current.scrollHeight + 2}px`;
    }

    if (headerRef.current) {
      setBracketMargin(headerRef.current?.clientHeight / 2)
    }
  }, [title]);

  React.useEffect(() => {
    const updateBracketMargin = () => setBracketMargin(headerRef.current?.clientHeight / 2)

    setHeight(topicRef.current.clientHeight || 0)

    window.addEventListener("resize", updateBracketMargin)
    return () => window.removeEventListener("resize", updateBracketMargin)
  }, [])

  return (
    <div className={`topic${alongsideCritique ? " original" : ""}${isCritique ? " critique" : ""}`} ref={topicRef} {...remainingProps}>
      <div className="bracket" style={{ marginTop: bracketMargin }} />
      <div className="body">
        <div className="header" ref={headerRef}>
          <div className="left-side">
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
          </div>
          {headerConfig &&
            <div className="right-side">
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
        {children.constructor === Array ?
          children
          :
          React.cloneElement(children, { ...headerStatus, readOnly, saveInLocalStorage, alongsideCritique })
        }
        {metrics &&
          <ul className="metrics">
            <li>Promovido por 40 usuários</li>
            <li>80% dos 135 votantes achou relevante</li>
            <li>4200 interações</li>
          </ul>
        }
      </div>
    </div>
  )
}