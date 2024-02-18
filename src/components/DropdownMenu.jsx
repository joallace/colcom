import React from "react"

export default function DropdownMenu({ options = {}, optionsStatus = [], children, className, top }) {
  const [isOpen, setIsOpen] = React.useState(false)
  const [internalStatus, setInternalStatus] = React.useState(
    Object.fromEntries(
      Object.entries(options)
        .map(([k, v]) => [k, v.initialValue])
        .filter(tuple => tuple[1] !== undefined)
    )
  )
  const [status, setStatus] = optionsStatus.length ? optionsStatus : [internalStatus, setInternalStatus]
  const menuRef = React.useRef()
  const triggerRef = React.useRef()


  const toggle = (str, value = undefined) => {
    if (status[str] !== undefined || value !== undefined)
      setStatus({
        ...status,
        [str]: (status[str] !== undefined) ? !status[str] : undefined,
        ...value
      })
  }

  const toggleMenu = () => { setIsOpen(!isOpen) }


  React.useEffect(() => {
    const outsideClickHandler = (e) => {
      if (!menuRef?.current?.contains(e.target) && !triggerRef?.current?.contains(e.target))
        setIsOpen(false)
    }

    document.addEventListener("mousedown", outsideClickHandler)
    return () => {
      document.removeEventListener("mousedown", outsideClickHandler)
    }
  }, [])


  return (
    <div className="dropdown-menu">
      <div className={`dropdown-trigger${className ? ` ${className}` : ""}`} onClick={toggleMenu} ref={triggerRef}>
        {children}
      </div>
      {isOpen && (
        <div className="dropdown-options" style={top ? { top } : undefined} ref={menuRef}>
          <ul>
            {
              Object.entries(options).map((([buttonName, buttonConfig]) => {
                const { icons, description, hide, disabled, onClick } = buttonConfig
                const active = disabled?.constructor === Function ?
                  !disabled(status)
                  :
                  disabled?.constructor === Boolean ?
                    !disabled
                    :
                    true

                if (hide)
                  return

                const [Icon, text] = icons.constructor === Array ?
                  [
                    icons[Number(status[buttonName])],
                    description[Number(status[buttonName])]
                  ]
                  :
                  [
                    icons,
                    description
                  ]

                return (
                  <li
                    key={buttonName}
                    className={active ? "" : " disabled"}
                    onClick={() => { if (active) { toggle(buttonName, onClick(status[buttonName])); toggleMenu() } }}
                  >
                    <Icon className={`dropdown-icon${active ? "" : " disabled"}`} /> {text}
                  </li>
                )
              }))
            }
          </ul>
        </div>
      )}
    </div>
  )
}