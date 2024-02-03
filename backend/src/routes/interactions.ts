import { Router } from "express"

import authHandler from "@/middleware/authHandler"
import { createInteraction, deleteInteraction, getContentInteractions, updateInteraction } from "@/controllers/interactions"


const router = Router()

router.get("/contents/:id/interactions", getContentInteractions)

router.get("/users/:id/interactions", getContentInteractions)

router.post("/interactions", authHandler, createInteraction)

router.patch("/interactions/:id", authHandler, updateInteraction)

router.delete("/interactions/:id", authHandler, deleteInteraction)


export default router