import { Router } from "express"

import authHandler from "@/middleware/authHandler"
import { getNotifications, getUnreadCount, readNotifications } from "@/controllers/notifications"


const router = Router()

router.get("/notifications", authHandler(), getNotifications)

router.get("/notifications/unread", authHandler(), getUnreadCount)

router.post("/notifications/read", authHandler(), readNotifications)

export default router
