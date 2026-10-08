import { Router } from "express"

import authHandler from "@/middleware/authHandler"
import { handleInteraction, getContentInteractions, getVoteHistory } from "@/controllers/interactions"


const router = Router()

router.get("/contents/:id/interactions", getContentInteractions)

router.get("/users/:id/interactions", getContentInteractions)

router.get("/topics/:id/votes", getVoteHistory)

router.post("/interactions", authHandler(), handleInteraction)


export default router