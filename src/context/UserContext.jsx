import React from "react"
// import { useNavigate } from "react-router-dom"

import env from "@/assets/enviroment"


export const UserContext = React.createContext()

export function UserProvider({ children }) {
  const [user, setUser] = React.useState(null)

  const fetchUser = async () => {
    const accessToken = localStorage.getItem("accessToken")
    if (!accessToken)
      return

    const url = `${env.apiAddress}/users/self`
    const res = await fetch(url, {
      method: "get",
      headers: { "Authorization": `Bearer ${accessToken}` },
    })
    const data = await res.json()

    if (!res.ok) {
      console.error(data)
      if (res.status === 404)
        localStorage.removeItem("accessToken")
      return
    }

    setUser(data)
  }

  const updatePromoted = (contentId) => {
    setUser(prev => ({ ...prev, promoting: contentId }))
  }

  React.useEffect(() => {
    if (localStorage.getItem("accessToken"))
      fetchUser()
  }, [])

  return (
    <UserContext.Provider value={{ user, fetchUser, updatePromoted }}>
      {children}
    </UserContext.Provider>
  )
}

export default function useUser() {
  return React.useContext(UserContext);
}
