import React from "react"

import env from "@/assets/enviroment"
import { UserContext } from "@/context/UserContext"


// The user of the stored token, or null when there's no token or the API refuses it
const requestUser = async () => {
  const accessToken = localStorage.getItem("accessToken")

  if (!accessToken)
    return null

  const url = `${env.apiAddress}/users/self`
  const res = await fetch(url, {
    method: "get",
    headers: { "Authorization": `Bearer ${accessToken}` },
  })
  const data = await res.json()

  if (res.status === 401) {
    localStorage.removeItem("accessToken")
    return null
  }

  return { ...data, accessToken }
}

export default function UserProvider({ children }) {
  // Without a token there's no one to fetch: logged out (null) rather than still loading (undefined)
  const [user, setUser] = React.useState(() => localStorage.getItem("accessToken") ? undefined : null)

  const clearUser = () => { localStorage.removeItem("accessToken"); setUser(null) }

  const fetchUser = async () => setUser(await requestUser())

  const updatePromoted = (contentId) => {
    setUser(prev => ({ ...prev, promoting: contentId }))
  }

  React.useEffect(() => {
    if (localStorage.getItem("accessToken"))
      requestUser().then(setUser)
  }, [])

  return (
    <UserContext.Provider value={{ user, clearUser, fetchUser, updatePromoted }}>
      {children}
    </UserContext.Provider>
  )
}
