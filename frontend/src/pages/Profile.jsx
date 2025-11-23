import React from "react"
import useUser from "@/context/UserContext"
import { relativeTime } from "@/assets/util"
import Spinner from "@/components/primitives/Spinner"
import Focus from "@/components/primitives/Focus"

export default function Profile() {
  const { user } = useUser()

  React.useEffect(() => {
    document.title = "Perfil · colcom"
  }, [])

  return (
    <div className="centered content">
      {
        user ?
          <div className="profileCard">
            <img className="avatar" src={`data:image/png;base64,${user?.avatar}`} />
            <div className="profileInfo">
              <Focus className="username">{user?.name}</Focus>
              <span>se juntou em <Focus>{new Date(user?.created_at).toLocaleDateString('pt-BR')}</Focus>, há <Focus>{relativeTime(user?.created_at)}</Focus></span>
            </div>
          </div>
          :
          <Spinner />
      }

    </div>
  )
}