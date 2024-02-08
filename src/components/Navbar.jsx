import React from "react"
import { NavLink, Link } from "react-router-dom"
import { PiUser, PiPlusBold, PiMedalFill, PiCoinsFill } from "react-icons/pi"

import Icon from "@/components/Icon"
import TopicModal from "@/components/TopicModal"
import useScreenSize from "@/hooks/useScreenSize"
import { UserContext } from "@/context/UserContext"

export default function Navbar() {
  const [modalOpen, setModalOpen] = React.useState(false)
  const toggleModal = () => setModalOpen(!modalOpen)

  const { user } = React.useContext(UserContext)
  const isDesktop = useScreenSize()

  return (
    <>
      <nav className="nav">
        <div>
          <Link to="/promoted" className="nav-icon">
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
          {user &&
            <>
              <a onClick={toggleModal}><PiPlusBold style={{ fontSize: "1.5rem" }} /></a>
              <div className="balance">
                <span>
                  {user.prestige}<PiMedalFill title="prestígio" />
                </span>
                <span>
                  {user.colcoins}<PiCoinsFill title="colcoins" />
                </span>
              </div>
            </>
          }
          <Link to="/login" className="nav-user-icon">
            <PiUser style={{ fontSize: "2rem" }} />
          </Link>
        </div>
      </nav>
      <TopicModal isOpen={modalOpen} setIsOpen={setModalOpen} />
    </>
  )
}