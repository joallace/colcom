import React from "react"
import { isEmptyObject } from "@tiptap/react"
import { PiDotsThreeVerticalBold } from "react-icons/pi"

import useScreenSize from "@/hooks/useScreenSize"
import VotingButtons from "@/components/VotingButtons"
import DropdownMenu from "@/components/DropdownMenu"


export default function Frame({
  id,
  title,
  titleRef,
  relevanceVote,
  setRelevanceVote,
  definitiveVote,
  setDefinitiveVote,
  metrics,
  headerConfig = {},
  saveInLocalStorage = false,
  readOnly = true,
  hideVoteButtons = false,
  showDefinitiveVoteButton = false,
  initialVoteState = { vote: false, relevance: "" },
  alongsideCritique = false,
  isCritique = false,
  justify = false,
  error = false,
  setError = () => { },
  setHeight = () => { },
  children,
  ...remainingProps
}) {
  const [headerStatus, setHeaderStatus] = React.useState(
    Object.fromEntries(
      Object.entries(headerConfig)
        .map(([k, v]) => [k, v.initialValue])
        .filter(tuple => tuple[1] !== undefined)
    )
  )
  const [dropdownHeight, setDropdownHeight] = React.useState(0)
  const topicRef = React.useRef()
  const dotsRef = React.useRef()
  const isDesktop = useScreenSize()

  const toggle = (str) => headerStatus[str] !== undefined && setHeaderStatus({ ...headerStatus, [str]: !headerStatus[str] })


  React.useEffect(() => {
    setHeight(topicRef?.current?.clientHeight || 0)
    setDropdownHeight((dotsRef?.current?.offsetTop + dotsRef?.current?.clientHeight) || 0)
  }, [])


  return (
    <div className={`frame${alongsideCritique ? " original" : ""}${isCritique ? " critique" : ""}`} ref={topicRef} {...remainingProps}>
      <div className="header">
        <div className={`top bracket${error ? " error" : ""}`} />
        {!hideVoteButtons &&
          <VotingButtons
            id={id}
            relevanceVote={relevanceVote}
            setRelevanceVote={setRelevanceVote}
            definitiveVote={definitiveVote}
            setDefinitiveVote={setDefinitiveVote}
            showDefinitiveVoteButton={showDefinitiveVoteButton}
          />
        }
        <h1
          className={`title${isCritique ? " critique" : ""}${error && !titleRef?.current?.textContent ? " error" : ""}`}
          contentEditable={!readOnly}
          placeholder="Qual é o título?"
          onKeyDown={e => { e.key === "Enter" && e.preventDefault(); setError(false) }}
          onBlur={() => saveInLocalStorage && localStorage.setItem("postTitle", titleRef?.current?.textContent)}
          ref={titleRef}
        >
          {title}
        </h1>
        {!isEmptyObject(headerConfig) &&
          <div className="buttons">
            {isDesktop ?
              <>
                {Object.entries(headerConfig).map((([buttonName, buttonConfig]) => {
                  if (buttonConfig.hide)
                    return

                  const index = Number(headerStatus[buttonName])

                  const Icon = buttonConfig.icons.constructor === Array ?
                    buttonConfig.icons[index]
                    :
                    buttonConfig.icons

                  const title = buttonConfig.description.constructor === Array ?
                    buttonConfig.description[index]
                    :
                    buttonConfig.description

                  return (
                    <Icon
                      key={buttonName}
                      className="icons"
                      title={title}
                      onClick={() => { buttonConfig.onClick(headerStatus[buttonName]); toggle(buttonName) }}
                    />
                  )
                }))}
              </>
              :
              <DropdownMenu
                options={headerConfig}
                optionsStatus={[headerStatus, setHeaderStatus]}
                top={dropdownHeight}
              >
                <div ref={dotsRef}>
                  <PiDotsThreeVerticalBold className="icons" />
                </div>
              </DropdownMenu>
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
        </div>
      </div>
      <div className={metrics ? "footer" : undefined}>
        <div className={`bottom bracket${error ? " error" : ""}`} />
        {metrics &&
          <ul className="metrics">
            {metrics().map((metric, index) => (
              <li key={`t${id}-info-${index}`}>{metric}</li>
            ))}
          </ul>
        }
      </div>
    </div>
  )
}