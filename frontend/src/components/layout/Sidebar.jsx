import React from "react"
import { createPortal } from "react-dom"
import { NavLink, Link, useLocation } from "react-router"
import { PiListBold, PiXBold, PiMagnifyingGlassBold, PiPaletteFill } from "react-icons/pi"

import BrandLogo from "@/components/primitives/BrandLogo"
import { Dialog } from "@/components/primitives/Modal"
import { NAV_LINKS } from "@/assets/navigation"

// The menu button of screens too narrow for the navbar's links, and the drawer it opens with all of
// them. The drawer is a modal `<dialog>` like `Modal`'s: focus stays in it, and Escape, a click on
// the backdrop or any navigation closes it. It's drawn in `<body>`, away from the navbar's styles.
export default function Sidebar() {
  const [isOpen, setIsOpen] = React.useState(false)
  const location = useLocation()
  const [openedAt, setOpenedAt] = React.useState(location.key)

  // Going elsewhere (the back button included) closes it
  if (openedAt !== location.key) {
    setOpenedAt(location.key)
    setIsOpen(false)
  }

  const close = () => setIsOpen(false)

  return (
    <>
      <button
        type="button"
        className="sidebarToggle"
        aria-label="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen(true)}
      >
        <PiListBold className="icon" />
      </button>
      {isOpen && createPortal(
        <Dialog
          className="sidebar"
          aria-label="navegação"
          onClose={close}
          // The dialog's own box is only hit outside its panel, on the backdrop
          onClick={e => e.target === e.currentTarget && close()}
        >
          <nav className="sidebarPanel">
            {/* The close button comes first, for the focus to land on when it opens */}
            <div className="sidebarHeader">
              <button type="button" className="close" aria-label="fechar" onClick={close}>
                <PiXBold className="icon" />
              </button>
              <Link to="/promoted" className="logo" onClick={close}>
                <BrandLogo />
              </Link>
            </div>
            <ul>
              {NAV_LINKS.map(({ to, label, icon: Icon }) =>
                <li key={to}>
                  <NavLink to={to} onClick={close}><Icon className="icon" /> {label}</NavLink>
                </li>
              )}
            </ul>
            <ul className="secondary">
              <li>
                <NavLink to="/search" onClick={close}><PiMagnifyingGlassBold className="icon" /> buscar</NavLink>
              </li>
              <li>
                <NavLink to="/settings" onClick={close}><PiPaletteFill className="icon" /> aparência</NavLink>
              </li>
            </ul>
          </nav>
        </Dialog>,
        document.body
      )}
    </>
  )
}
