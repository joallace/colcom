import React from "react"
import { PiDotsThreeVerticalBold } from "react-icons/pi"

import useBreakpoint from "@/hooks/useBreakpoint"
import VotingButtons from "@/components/primitives/VotingButtons"
import DropdownMenu from "@/components/primitives/DropdownMenu"


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
  definitiveVoteType,
  alongsideCritique = false,
  isCritique = false,
  justify = false,
  error = false,
  setError = () => { },
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
    setDropdownHeight((dotsRef?.current?.offsetTop + dotsRef?.current?.clientHeight) || 0)
  }, [])

  // The title is plain text: dropped HTML or formatting shortcuts (Ctrl+B…) would nest tags and
  // styles in it. Pasting is handled by `onPaste`. React's `onBeforeInput` has no `inputType`
  React.useEffect(() => {
    const title = titleRef?.current
    if (readOnly || !title)
      return

    const keepPlainText = e => {
      if (e.inputType === "insertFromDrop" || e.inputType.startsWith("format"))
        e.preventDefault()
    }
    title.addEventListener("beforeinput", keepPlainText)
    return () => title.removeEventListener("beforeinput", keepPlainText)
  }, [readOnly, titleRef])


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
            definitiveVoteType={definitiveVoteType}
          />
        }
        {/* The error style only applies to an empty title (`:empty` in _frame.scss) */}
        <h1
          className={`title${isCritique ? " critique" : ""}${error ? " error" : ""}`}
          // Not "plaintext-only": Firefox before 136 doesn't know it and leaves the title uneditable
          contentEditable={!readOnly}
          suppressContentEditableWarning={true}
          placeholder="Qual é o título?"
          onKeyDown={e => { e.key === "Enter" && e.preventDefault(); setError(false) }}
          onPaste={e => {
            if (readOnly)
              return
            e.preventDefault()
            // A title is one line; `insertText` keeps the paste undoable
            document.execCommand("insertText", false, e.clipboardData.getData("text/plain").replace(/\s+/g, " "))
            setError(false)
          }}
          onBlur={() => saveInLocalStorage && localStorage.setItem("postTitle", titleRef?.current?.textContent)}
          ref={titleRef}
        >
          {title}
        </h1>
        {Object.keys(headerConfig ?? {}).length > 0 &&
          <div className="buttons">
            {isDesktop ?
              <>
                {Object.entries(headerConfig).map((([buttonName, buttonConfig]) => {
                  const { icons, description, hide, disabled, onClick } = buttonConfig

                  if (hide)
                    return

                  const active = disabled?.constructor === Function ?
                    !disabled(headerStatus)
                    :
                    disabled?.constructor === Boolean ?
                      !disabled
                      :
                      true

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
                    <div
                      className={`clickable${active ? "" : " disabled"}`}
                      onClick={() => { if (active) { toggle(buttonName, onClick(headerStatus[buttonName])) } }}
                      title={title}
                      key={`f${id}-${buttonName}`}
                    >
                      <Icon />
                      <span>{title.replace(" ", "\n")}</span>
                    </div>
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
                  <PiDotsThreeVerticalBold className="clickable" />
                </div>
              </DropdownMenu>
            }
          </div>
        }
      </div>
      <div className="container">
        <div className={`bracket${error ? " error" : ""}`} />
        <div className={`body${justify ? " justify" : ""}`}>
          {/* The header state is handed to a single child component; arrays and Fragments can't take props */}
          {children.constructor === Array || children.type === React.Fragment ?
            children
            :
            React.cloneElement(children, { ...headerStatus, readOnly, saveInLocalStorage, alongsideCritique })
          }
        </div>
      </div>
      <div className={metrics ? "footer" : undefined}>
        <div className={`bottom bracket${error ? " error" : ""}`} />
        {metrics &&
          <ul className={`metrics${isCritique ? " critique" : ""}`}>
            {metrics().map((metric, index, arr) => (
              <React.Fragment key={`f${id}-metric-${index}`}>
                <li>{metric}</li>
                {isDesktop && ((index + 1) !== arr.length) && "•"}
              </React.Fragment>
            ))}
          </ul>
        }
      </div>
    </div>
  )
}