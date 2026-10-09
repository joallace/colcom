import React from "react"
import { Link } from "react-router"
import { PiBellFill } from "react-icons/pi"

import Popover from "@/components/primitives/Popover"
import Spinner from "@/components/primitives/Spinner"
import NotificationItem from "@/components/content/NotificationItem"
import env from "@/assets/enviroment"
import { markRead } from "@/assets/notifications"
import useUser from "@/context/UserContext"
import useUnreadNotifications from "@/hooks/useUnreadNotifications"


const LATEST_COUNT = 5

const unreadLabel = unread => `${unread} não lida${unread === 1 ? "" : "s"}`

// The latest notifications, fetched each time the popover opens (it's mounted only while open)
function LatestNotifications({ close }) {
  const { user } = useUser()
  const token = user.accessToken
  // undefined while loading, null when it failed
  const [notifications, setNotifications] = React.useState()

  React.useEffect(() => {
    let cancelled = false

    const fetchLatest = async () => {
      try {
        const res = await fetch(`${env.apiAddress}/notifications?page=1&pageSize=${LATEST_COUNT}`, {
          headers: { "Authorization": `Bearer ${token}` }
        })
        const data = res.ok ? await res.json() : undefined
        if (!cancelled)
          setNotifications(data?.notifications ?? null)
      }
      catch (err) {
        console.error(err)
        if (!cancelled)
          setNotifications(null)
      }
    }

    fetchLatest()
    return () => { cancelled = true }
  }, [token])

  const openNotification = notification => {
    if (!notification.read)
      markRead(token, [notification.id])
  }

  return (
    <>
      {notifications === undefined ?
        <Spinner size="1.5rem" />
        :
        notifications === null ?
          <p className="empty">não foi possível carregar as notificações.</p>
          :
          notifications.length > 0 ?
            // Any link inside leads elsewhere: the user's profile or what the notification is about
            <ul className="notificationList" onClick={event => event.target.closest("a") && close()}>
              {notifications.map(notification =>
                <NotificationItem key={notification.id} notification={notification} onOpen={() => openNotification(notification)} />
              )}
            </ul>
            :
            <p className="empty">nenhuma notificação por aqui.</p>
      }
      <Link to="/notifications" className="seeAll" onClick={close}>ver todas as notificações</Link>
    </>
  )
}

// The navbar's bell: the unread count, and the latest notifications when clicked
export default function NotificationBell() {
  const unread = useUnreadNotifications()

  return (
    <Popover
      className="notificationsLink"
      placement="bottom-end"
      heading="notificações"
      panelClassName="notificationsPopover"
      content={({ close }) => <LatestNotifications close={close} />}
      title={unread ? `notificações (${unreadLabel(unread)})` : "notificações"}
      aria-label={unread ? `notificações, ${unreadLabel(unread)}` : "notificações"}
    >
      <PiBellFill style={{ fontSize: "1.5rem" }} />
      {unread > 0 && <span className="badge" aria-hidden="true">{unread > 99 ? "99+" : unread}</span>}
    </Popover>
  )
}
