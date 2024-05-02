import React from "react"
import { NavLink, Link, useNavigate } from "react-router-dom"
import { PiUser, PiUserFill, PiPlusBold, PiMedalFill, PiCoinsFill, PiBookmarkSimpleFill, PiSignOutFill } from "react-icons/pi"

import Icon from "@/components/Icon"
import TopicModal from "@/components/TopicModal"
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
          <Link to="/promoted" className="nav-icon">
            <Icon isDesktop={isDesktop} />
          </Link>
          <ul className="unselectable paths">
            <li key="promoted">
              <NavLink to="/promoted">promovido</NavLink>
            </li>
            •
            <li key="all">
              <NavLink to="/all">todos</NavLink>
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
                  {user.name}
                </>
              }
              <DropdownMenu
                className="nav-user-icon"
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
                <PiUser />
              </DropdownMenu>
            </>
            :
            <>
              <Link to="/login" title="criar tópico">
                <PiPlusBold style={{ fontSize: "1.5rem" }} />
              </Link>
              {/* <Link to="/login">log in</Link> */}
              <Link to="/login" className="nav-user-icon" title="login e criação de conta">
                <PiUser />
              </Link>
            </>
          }
        </div>
      </nav>
      <TopicModal isOpen={modalOpen} setIsOpen={setModalOpen} />
    </>
  )
}