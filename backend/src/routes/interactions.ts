import { Router } from "express"

import authHandler from "@/middleware/authHandler"
import { interactionsLimit } from "@/middleware/rateLimit"
import { handleInteraction, getVoteHistory } from "@/controllers/interactions"


const router = Router()

router.get("/topics/:id/votes", getVoteHistory)

router.post("/interactions", authHandler(), interactionsLimit, handleInteraction)


export default router
