import { RequestHandler } from "express"

import Notifications from "@/models/notifications"
import { validate } from "@/validation"


export const getNotifications: RequestHandler = async (req, res, next) => {
  const user_pid = res.locals.user.pid

  try {
    const { page, pageSize, unread } = validate("notifications", req.query)
    const { notifications, count } = await Notifications.findByUser(user_pid, { page, pageSize, unread })

    res.status(200).json({ notifications, count, unread: await Notifications.countUnread(user_pid) })
  }
  catch (err) {
    next(err)
  }
}

// What the navbar polls, so it's only a count
export const getUnreadCount: RequestHandler = async (req, res, next) => {
  try {
    res.status(200).json({ unread: await Notifications.countUnread(res.locals.user.pid) })
  }
  catch (err) {
    next(err)
  }
}

export const readNotifications: RequestHandler = async (req, res, next) => {
  const user_pid = res.locals.user.pid

  try {
    const { ids } = validate("readNotifications", req.body)
    const read = await Notifications.markRead(user_pid, ids)

    res.status(200).json({ read, unread: await Notifications.countUnread(user_pid) })
  }
  catch (err) {
    next(err)
  }
}
