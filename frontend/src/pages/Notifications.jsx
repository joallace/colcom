import React from "react"
import { Navigate, useLocation } from "react-router"
import { PiChecksBold } from "react-icons/pi"

import NoResponse from "@/components/primitives/NoResponse"
import Spinner from "@/components/primitives/Spinner"
import Pagination from "@/components/primitives/Pagination"
import NotificationItem from "@/components/content/NotificationItem"
import env from "@/assets/enviroment"
import { markRead, announceUnread } from "@/assets/notifications"
import { loginPath } from "@/assets/returnTo"
import useUser from "@/context/UserContext"
import usePageParam from "@/hooks/usePageParam"


const PAGE_SIZE = 20

export default function Notifications() {
  const [notifications, setNotifications] = React.useState([])
  const [unread, setUnread] = React.useState(0)
  const [page, setPage] = usePageParam()
  const [maxIndex, setMaxIndex] = React.useState()
  // What the shown notifications were fetched for; it's loading until that's what is asked for
  const [loaded, setLoaded] = React.useState({})
  const { user } = useUser()
  const location = useLocation()
  const isLoading = loaded.user !== user || loaded.page !== page

  React.useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const url = `${env.apiAddress}/notifications?page=${page + 1}&pageSize=${PAGE_SIZE}`
        const res = await fetch(url, { headers: { "Authorization": `Bearer ${user.accessToken}` } })
        const data = await res.json()

        if (res.ok) {
          setNotifications(data.notifications)
          setUnread(data.unread)
          setMaxIndex(Math.ceil(data.count / PAGE_SIZE) - 1)
          announceUnread(data.unread)
        }
        else
          setNotifications([])
      }
      catch (err) {
        console.error(err)
      }
      finally {
        setLoaded({ user, page })
      }
    }

    if (user)
      fetchNotifications()
  }, [user, page])

  React.useEffect(() => {
    document.title = "colcom: notificações"
  }, [])

  if (user === null)
    return <Navigate to={loginPath(location)} replace />

  const markShownRead = ids => setNotifications(prev => prev.map(n => !ids || ids.includes(n.id) ? { ...n, read: true } : n))

  const openNotification = notification => {
    if (notification.read)
      return
    markShownRead([notification.id])
    markRead(user.accessToken, [notification.id])
  }

  const readAll = async () => {
    const count = await markRead(user.accessToken)
    if (count !== undefined) {
      markShownRead()
      setUnread(count)
    }
  }

  return (
    <div className={`content${notifications.length === 0 ? " centered" : ""}`}>
      {
        isLoading ?
          <Spinner />
          :
          notifications.length > 0 ?
            <section className="notifications">
              <header>
                <h1>notificações</h1>
                {unread > 0 &&
                  <button className="readAll" onClick={readAll}>
                    <PiChecksBold /> marcar todas como lidas
                  </button>
                }
              </header>
              <ul className="notificationList">
                {notifications.map(notification =>
                  <NotificationItem key={notification.id} notification={notification} onOpen={() => openNotification(notification)} />
                )}
              </ul>
            </section>
            :
            <NoResponse>
              nenhuma notificação por aqui... quando alguém criticar, sugerir ou responder algo seu, aparecerá aqui.
            </NoResponse>
      }
      <Pagination
        path="/notifications"
        state={[page, setPage]}
        isLoading={isLoading}
        maxIndex={maxIndex}
      />
    </div>
  )
}
