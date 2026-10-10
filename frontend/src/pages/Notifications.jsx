import React from "react"
import { Navigate, useLocation } from "react-router"
import { PiChecksBold } from "react-icons/pi"

import NoResponse from "@/components/primitives/NoResponse"
import Spinner from "@/components/primitives/Spinner"
import Pagination from "@/components/primitives/Pagination"
import NotificationItem from "@/components/content/NotificationItem"
import { markRead, announceUnread } from "@/assets/notifications"
import { loginPath } from "@/assets/returnTo"
import useUser from "@/context/UserContext"
import useApiResource from "@/hooks/useApiResource"
import usePageParam from "@/hooks/usePageParam"


const PAGE_SIZE = 20

export default function Notifications() {
  const [page, setPage] = usePageParam()
  const { user } = useUser()
  const location = useLocation()
  const { data, isLoading, setData } = useApiResource(user ? `/notifications?page=${page + 1}&pageSize=${PAGE_SIZE}` : null, { deps: [user, page] })
  const notifications = data?.notifications ?? []
  const unread = data?.unread ?? 0
  // The last count known, kept while the next page loads
  const [maxIndex, setMaxIndex] = React.useState()
  const loadedMaxIndex = data && Math.ceil(data.count / PAGE_SIZE) - 1
  if (loadedMaxIndex !== undefined && loadedMaxIndex !== maxIndex)
    setMaxIndex(loadedMaxIndex)

  // Once per load, not when marking some read changes the data: markRead announces those
  const announceLoaded = React.useEffectEvent(() => data && announceUnread(data.unread))
  React.useEffect(() => {
    if (!isLoading)
      announceLoaded()
  }, [isLoading])

  React.useEffect(() => {
    document.title = "colcom: notificações"
  }, [])

  if (user === null)
    return <Navigate to={loginPath(location)} replace />

  const markShownRead = (ids, unread) => setData(prev => ({
    ...prev,
    notifications: prev.notifications.map(n => !ids || ids.includes(n.id) ? { ...n, read: true } : n),
    unread: unread ?? prev.unread
  }))

  const openNotification = notification => {
    if (notification.read)
      return
    markShownRead([notification.id])
    markRead([notification.id])
  }

  const readAll = async () => {
    const count = await markRead()
    if (count !== undefined)
      markShownRead(undefined, count)
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
