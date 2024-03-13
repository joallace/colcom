import { Router } from "express"

import authHandler from "@/middleware/authHandler"
import { handleInteraction, getContentInteractions, rejectSuggestion } from "@/controllers/interactions"


const router = Router()

router.get("/contents/:id/interactions", getContentInteractions)

router.get("/users/:id/interactions", getContentInteractions)

router.post("/interactions", authHandler(), handleInteraction)

router.get("/interactions/:hash/reject", authHandler(), rejectSuggestion)


export default router