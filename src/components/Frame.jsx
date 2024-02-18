import React from "react"
import { isEmptyObject } from "@tiptap/react"
import { PiDotsThreeVerticalBold } from "react-icons/pi"

import useBreakpoint from "@/hooks/useBreakpoint"
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
  const ref = React.useRef()
  const dotsRef = React.useRef()
  const isDesktop = useBreakpoint()

  const toggle = (str, value = undefined) => {
    if (headerStatus[str] !== undefined || value !== undefined)
      setHeaderStatus({
        ...headerStatus,
        [str]: (headerStatus[str] !== undefined) ? !headerStatus[str] : undefined,
        ...value
      })
  }
  

  React.useEffect(() => {
    setHeight(ref?.current?.clientHeight || 0)
    setDropdownHeight((dotsRef?.current?.offsetTop + dotsRef?.current?.clientHeight) || 0)
  }, [])


  return (
    <div className={`frame${alongsideCritique ? " original" : ""}${isCritique ? " critique" : ""}`} ref={ref} {...remainingProps}>
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
                  const { icons, description, hide, disabled, onClick } = buttonConfig

                  if (hide)
                    return

                  const index = Number(headerStatus[buttonName])

                  const Icon = icons.constructor === Array ?
                    icons[index]
                    :
                    icons

                  const title = description.constructor === Array ?
                    description[index]
                    :
                    description

                  return (
                    <Icon
                      key={`${id}-${buttonName}`}
                      className={`icons${disabled ? " disabled" : ""}`}
                      title={title}
                      onClick={() => { if (!disabled) { toggle(buttonName, onClick(headerStatus[buttonName], headerStatus)) } }}
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