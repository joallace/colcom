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

  // Revokes the session on the API (all of the user's sessions, on every device) and forgets it
  // here at once, without waiting: a failed or slow request must not keep anyone logged in
  const logout = () => {
    const accessToken = localStorage.getItem("accessToken")
    clearUser()

    if (!accessToken)
      return Promise.resolve()

    return fetch(`${env.apiAddress}/logout`, {
      method: "post",
      headers: { "Authorization": `Bearer ${accessToken}` },
    }).catch(err => console.error(err))
  }

  const fetchUser = async () => setUser(await requestUser())

  const updatePromoted = (contentId) => {
    setUser(prev => ({ ...prev, promoting: contentId }))
  }

  React.useEffect(() => {
    if (localStorage.getItem("accessToken"))
      requestUser().then(setUser)

    // Coming back to the tab, check the session still holds: it may have been ended on another
    // device or tab. Only an ended one changes the state, so pages don't reload their data.
    const recheck = async () => {
      if (document.visibilityState !== "visible")
        return
      try {
        if (!(await requestUser()))
          setUser(null)
      }
      catch (err) {
        console.error(err)
      }
    }
    document.addEventListener("visibilitychange", recheck)
    return () => document.removeEventListener("visibilitychange", recheck)
  }, [])

  return (
    <UserContext.Provider value={{ user, clearUser, logout, fetchUser, updatePromoted }}>
      {children}
    </UserContext.Provider>
  )
}
