import React from "react"
// import { useNavigate } from "react-router-dom"

import env from "@/assets/enviroment"


export const UserContext = React.createContext()

export function UserProvider({ children }) {
  const [user, setUser] = React.useState(undefined)

  const clearUser = () => { localStorage.removeItem("accessToken"); setUser(null) }

  const fetchUser = async () => {
    const accessToken = localStorage.getItem("accessToken")

    if (!accessToken) {
      setUser(null)
      return
    }

    const url = `${env.apiAddress}/users/self`
    const res = await fetch(url, {
      method: "get",
      headers: { "Authorization": `Bearer ${accessToken}` },
    })
    const data = await res.json()

    if (res.status === 401) {
      clearUser()
      return
    }
    const avatar = new Uint8Array(atob(data.avatar).split("").map(c => c.charCodeAt(0)))

    setUser({ ...data, avatar, accessToken })
  }

  const updatePromoted = (contentId) => {
    setUser(prev => ({ ...prev, promoting: contentId }))
  }

  React.useEffect(() => {
    if (localStorage.getItem("accessToken"))
      fetchUser()
    else
      setUser(null)
  }, [])

  return (
    <UserContext.Provider value={{ user, clearUser, fetchUser, updatePromoted }}>
      {children}
    </UserContext.Provider>
  )
}

export default function useUser() {
  return React.useContext(UserContext);
}
