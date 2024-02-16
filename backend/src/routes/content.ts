import { Router } from "express"

import authHandler from "@/middleware/authHandler"
import { getContents, createContent, getContent, getContentHistory, getContentTree, getTopicTree, updateContent } from "@/controllers/content"


const router = Router()

router.get("/contents", getContents)

router.get("/topics", authHandler(true), getContentTree)

router.get("/topics/:id", authHandler(true), getTopicTree)

router.post("/contents", authHandler(), createContent)

router.get("/contents/:id", authHandler(true), getContent)

router.patch("/contents/:id", authHandler(), updateContent)

router.get("/contents/:id/history", getContentHistory)

export default router