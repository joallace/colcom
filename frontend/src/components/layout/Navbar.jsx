import React from "react"
import { NavLink, Link, useLocation, useNavigate } from "react-router"
import {
  PiUserFill,
  PiPlusBold,
  PiMedalFill,
  PiBookmarkSimpleFill,
  PiSignOutFill,
  PiSignInFill,
  PiMagnifyingGlassBold
} from "react-icons/pi"

import BrandLogo from "@/components/primitives/BrandLogo"
import TopicModal from "@/components/content/TopicModal"
import DropdownMenu from "@/components/primitives/DropdownMenu"
import NotificationBell from "@/components/layout/NotificationBell"
import SearchBox from "@/components/layout/SearchBox"
import Spinner from "@/components/primitives/Spinner"
import useBreakpoint from "@/hooks/useBreakpoint"
import useUser from "@/context/UserContext"
import { loginPath, loginState } from "@/assets/returnTo"

export default function Navbar() {
  const [modalOpen, setModalOpen] = React.useState(false)
  const { user, logout } = useUser()
  const navigate = useNavigate()
  const location = useLocation()
  const isDesktop = useBreakpoint("md")
  const isLargeScreen = useBreakpoint("lg")

  const toggleModal = () => setModalOpen(!modalOpen)

  return (
    <>
      <nav>
        <div>
          <Link to="/promoted" className="logo">
            <BrandLogo isDesktop={isDesktop} />
          </Link>
          <ul className="unselectable paths">
            <li key="promoted">
              <NavLink to="/promoted">promovidos</NavLink>
            </li>
            •
            <li key="all">
              <NavLink to="/recent">recentes</NavLink>
            </li>
            {isLargeScreen &&
              <>
                •
                <li key="leaderboard">
                  <NavLink to="/leaderboard">pódio</NavLink>
                </li>
                •
                <li key="meta">
                  <NavLink to="/meta">meta</NavLink>
                </li>
              </>
            }
          </ul>
        </div>
        <div className="rightSide">
          {/* The search page has its own field */}
          {location.pathname !== "/search" && (isLargeScreen ?
            <SearchBox key={location.key} className="navSearch" />
            :
            <Link to="/search" title="buscar"><PiMagnifyingGlassBold style={{ fontSize: "1.5rem" }} /></Link>
          )}
          {user ?
            <>
              <a onClick={toggleModal} title="criar tópico"><PiPlusBold style={{ fontSize: "1.5rem" }} /></a>
              <NotificationBell />

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
                className="userInfo"
                options={{
                  "profile": {
                    description: isDesktop ? "meu perfil" : user.name,
                    icons: PiUserFill,
                    onClick: () => { navigate("/profile") }
                    // hide: isDesktop
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
                    onClick: () => { logout(); navigate("/login") }
                  }
                }}
              >
                {isDesktop && <span>{user.name}</span>}
                <img className="avatar" src={`data:image/png;base64,${user.avatar}`} />
              </DropdownMenu>
            </>
            :
            <>
              {user ?
                <Link to="/login" title="criar tópico">
                  <PiPlusBold className="icon" />
                </Link>
                :
                user === null ?
                  <Link to={loginPath(location)} state={loginState(location)} className="userInfo" title="login e criação de conta">
                    entrar
                    <PiSignInFill className="icon" />
                  </Link>
                  :
                  <Spinner size="1rem"/>
              }
            </>
          }
        </div>
      </nav>
      <TopicModal isOpen={modalOpen} setIsOpen={setModalOpen} />
    </>
  )
}
