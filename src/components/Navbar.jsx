import React from "react"

import Icon from "./Icon"
import { screenSm } from "../assets/scss/_export.module.scss"

export default function Navbar() {
  const smScreenSize = parseInt(screenSm)

  const [isDesktop, setDesktop] = React.useState(window.innerWidth > smScreenSize)

  const updateMedia = ()=>{setDesktop(window.innerWidth > smScreenSize)}

  React.useEffect(() => {
    window.addEventListener("resize", updateMedia);
    return () => window.removeEventListener("resize", updateMedia);
  });

  return (
    <nav className="nav">
      <div>
        <a href="/" className="nav-icon">
          <Icon isDesktop={isDesktop}/>
        </a>
        <ul>
          <li>
            <a href="/promoted">promovido</a>
          </li>
          <li>
            <a href="/all">todos</a>
          </li>
          <li>
            <a href="/meta">meta</a>
          </li>
        </ul>
      </div>
      <div style={{gap: "0.75rem"}}>
        <input className="nav-searchbar" placeholder="pesquisar..."/>
        <text style={{fontWeight: "bolder", fontSize: "1.5rem"}}>+</text>
        $42
        <div className="nav-user-icon"/>
      </div>
    </nav>
  )
}