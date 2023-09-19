import React from "react"
import { NavLink, Link } from "react-router-dom"
import { PiMagnifyingGlassBold, PiUser, PiPlusBold } from "react-icons/pi"

import Icon from "./Icon"
import { screenSm } from "../assets/scss/_export.module.scss"

export default function Navbar() {
  const smScreenSize = parseInt(screenSm)

  const [isDesktop, setDesktop] = React.useState(window.innerWidth > smScreenSize)

  const updateMedia = () => { setDesktop(window.innerWidth > smScreenSize) }

  React.useEffect(() => {
    window.addEventListener("resize", updateMedia);
    return () => window.removeEventListener("resize", updateMedia);
  });

  return (
    <nav className="nav">
      <div>
        <Link to="/" className="nav-icon">
          <Icon isDesktop={isDesktop} />
        </Link>
        <ul>
          <li>
            <NavLink to="/promoted">promovido</NavLink>
          </li>
          <li>
            <NavLink to="/all">todos</NavLink>
          </li>
          <li>
            <NavLink to="/meta">meta</NavLink>
          </li>
        </ul>
      </div>
      <div className="nav-right">
        {isDesktop ?
          <>
            <input className="nav-searchbar" placeholder="pesquisar..." />
            <Link to="/write"><PiPlusBold style={{ fontSize: "1.5rem" }}/></Link>            
          </>
          :
          <PiMagnifyingGlassBold style={{ fontSize: "1.25rem" }} />
        }
        $42
        <div className="nav-user-icon">
          <PiUser style={{ fontSize: "2rem" }} />
        </div>

      </div>
    </nav>
  )
}