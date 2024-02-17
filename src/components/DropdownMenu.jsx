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


  const toggle = (str) => { setStatus({ ...status, [str]: !status[str] }) }

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
                if (buttonConfig.hide)
                  return

                const [Icon, description] = buttonConfig.icons.constructor === Array ?
                  [
                    buttonConfig.icons[Number(status[buttonName])],
                    buttonConfig.description[Number(status[buttonName])]
                  ]
                  :
                  [
                    buttonConfig.icons,
                    buttonConfig.description
                  ]

                return (
                  <li key={buttonName} onClick={() => { buttonConfig.onClick(status[buttonName]); toggle(buttonName); toggleMenu() }}>
                    <Icon className="dropdown-icon" /> {description}
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