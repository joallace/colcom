import React from "react"
import { useLocation } from "react-router"

import useUser from "@/context/UserContext"
import { fetchUnread, UNREAD_EVENT } from "@/assets/notifications"


const POLL_INTERVAL = 60_000

// How many notifications the logged in user hasn't read. Asked again on every navigation, every
// minute while the tab is visible and on coming back to it, and updated at once when a page marks
// some as read (UNREAD_EVENT).
export default function useUnreadNotifications() {
  const { user } = useUser()
  const { pathname } = useLocation()
  const token = user?.accessToken
  // Kept with the token it was fetched for, so another account (or none) never sees it
  const [unread, setUnread] = React.useState({ token: undefined, count: 0 })

  React.useEffect(() => {
    if (!token)
      return

    let cancelled = false
    const refresh = async () => {
      if (document.visibilityState === "hidden")
        return
      try {
        const count = await fetchUnread(token)
        if (!cancelled && count !== undefined)
          setUnread({ token, count })
      }
      catch (err) {
        console.error(err)
      }
    }
    const onAnnounce = event => setUnread({ token, count: event.detail })

    refresh()
    const interval = setInterval(refresh, POLL_INTERVAL)
    document.addEventListener("visibilitychange", refresh)
    window.addEventListener(UNREAD_EVENT, onAnnounce)

    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener("visibilitychange", refresh)
      window.removeEventListener(UNREAD_EVENT, onAnnounce)
    }
  }, [token, pathname])

  return token && unread.token === token ? unread.count : 0
}
