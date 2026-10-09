import { Link } from "react-router"

import { describeNotification } from "@/assets/notifications"
import { relativeTime, userPath } from "@/assets/util"


// One notification, in a `.notificationList`. `onOpen` is called when its link is followed.
export default function NotificationItem({ notification, onOpen }) {
  const { actor, read, created_at } = notification
  const { action, target, path, detail } = describeNotification(notification)

  return (
    <li className={read ? undefined : "unread"}>
      <img className="avatar" src={`data:image/png;base64,${actor.avatar}`} alt="" />
      <div>
        <p>
          <Link to={userPath(actor.name)}>{actor.name}</Link> {action} <Link to={path} onClick={onOpen}>{target}</Link>
          {!read && <span className="visuallyHidden"> (não lida)</span>}
        </p>
        {detail && <p className="detail">{detail}</p>}
        <time dateTime={created_at}>{relativeTime(created_at)}</time>
      </div>
    </li>
  )
}
