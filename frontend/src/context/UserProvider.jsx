import React from "react"

import api, { ApiError, getToken, SESSION_ENDED_EVENT, TOKEN_KEY } from "@/assets/api"
import { UserContext } from "@/context/UserContext"


// The user of the stored token, or null when there's no token or the API refuses it (the client
// has then already announced the session's end)
const requestUser = async () => {
  const accessToken = getToken()

  if (!accessToken)
    return null

  try {
    return { ...await api.get("/users/self"), accessToken }
  }
  catch (err) {
    if (err instanceof ApiError && err.status === 401)
      return null
    throw err
  }
}

export default function UserProvider({ children }) {
  // Without a token there's no one to fetch: logged out (null) rather than still loading (undefined)
  const [user, setUser] = React.useState(() => getToken() ? undefined : null)

  const clearUser = () => { localStorage.removeItem(TOKEN_KEY); setUser(null) }

  // Revokes the session on the API (all of the user's sessions, on every device) and forgets it
  // here at once, without waiting: a failed or slow request must not keep anyone logged in
  const logout = () => {
    const accessToken = getToken()
    clearUser()

    if (!accessToken)
      return Promise.resolve()

    // Already forgotten here, so the token is passed along
    return api.post("/logout", undefined, { token: accessToken }).catch(err => console.error(err))
  }

  const fetchUser = async () => setUser(await requestUser())

  const updatePromoted = (contentId) => {
    setUser(prev => ({ ...prev, promoting: contentId }))
  }

  React.useEffect(() => {
    if (getToken())
      requestUser().then(setUser, err => console.error(err))

    // The API refused a request's token (see assets/api.js): the session ended elsewhere or expired
    const endSession = () => { localStorage.removeItem(TOKEN_KEY); setUser(null) }
    window.addEventListener(SESSION_ENDED_EVENT, endSession)

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
    return () => {
      window.removeEventListener(SESSION_ENDED_EVENT, endSession)
      document.removeEventListener("visibilitychange", recheck)
    }
  }, [])

  return (
    <UserContext.Provider value={{ user, clearUser, logout, fetchUser, updatePromoted }}>
      {children}
    </UserContext.Provider>
  )
}
