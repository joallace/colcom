import React from "react"
import { NavLink, Link, useNavigate } from "react-router-dom"
import {
  PiUser,
  PiUserFill,
  PiPlusBold,
  PiMedalFill,
  PiCoinsFill,
  PiBookmarkSimpleFill,
  PiSignOutFill,
  PiSignInFill
} from "react-icons/pi"

import Icon from "@/components/primitives/Icon"
import TopicModal from "@/components/content/TopicModal"
import DropdownMenu from "@/components/primitives/DropdownMenu"
import useBreakpoint from "@/hooks/useBreakpoint"
import useUser from "@/context/UserContext"

export default function Navbar() {
  const [modalOpen, setModalOpen] = React.useState(false)
  const { user, clearUser } = useUser()
  const navigate = useNavigate()
  const isDesktop = useBreakpoint()

  const toggleModal = () => setModalOpen(!modalOpen)


  return (
    <>
      <nav className="nav">
        <div>
          <Link to="/promoted" className="nav-main-icon">
            <Icon isDesktop={isDesktop} />
          </Link>
          <ul className="unselectable paths">
            <li key="promoted">
              <NavLink to="/promoted">promovidos</NavLink>
            </li>
            •
            <li key="all">
              <NavLink to="/recent">recentes</NavLink>
            </li>
            {isDesktop &&
              <>
                •
                <li key="leaderboard">
                  <NavLink to="/leaderboard">leaderboard</NavLink>
                </li>
                •
                <li key="meta">
                  <NavLink to="/meta">meta</NavLink>
                </li>
              </>
            }
          </ul>
        </div>
        <div className="nav-right">
          {user ?
            <>
              <a onClick={toggleModal} title="criar tópico"><PiPlusBold style={{ fontSize: "1.5rem" }} /></a>

              {isDesktop &&
                <>
                  <div className="balance">
                    <span>
                      {user.prestige}<PiMedalFill title="prestígio" />
                    </span>
                    {/*
                    <span>
                      {user.colcoins}<PiCoinsFill title="colcoins" />
                    </span> 
                    */}
                  </div>
                </>
              }
              <DropdownMenu
                className="nav-user-drop"
                options={{
                  "user": {
                    description: user.name,
                    icons: PiUserFill,
                    hide: isDesktop
                  },
                  "balance": {
                    description: `prestígio: ${user.prestige}`,
                    icons: PiMedalFill,
                    hide: isDesktop
                  },
                  "bookmarked": {
                    description: "conteúdos salvos",
                    icons: PiBookmarkSimpleFill,
                    onClick: () => { navigate("/bookmarked") }
                  },
                  "logout": {
                    description: "sair",
                    icons: PiSignOutFill,
                    onClick: () => { clearUser(); navigate("/login") }
                  }
                }}
              >
                <span>{user.name}</span>
                <img className="avatar" src={`data:image/png;base64,${user.avatar}`} />
              </DropdownMenu>
            </>
            :
            <>
              <Link to="/login" title="criar tópico">
                <PiPlusBold className="nav-icon" />
              </Link>
              <Link to="/login" className="nav-user-drop" title="login e criação de conta">
                entrar
                <PiSignInFill className="nav-icon" />
              </Link>
            </>
          }
        </div>
      </nav>
      <TopicModal isOpen={modalOpen} setIsOpen={setModalOpen} />
    </>
  )
}
