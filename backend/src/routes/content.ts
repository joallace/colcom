import { Router } from "express"

import authHandler from "@/middleware/authHandler"
import { getContents, createContent, getContent, getContentHistory, getContentTree, getTopicTree } from "@/controllers/content"


const router = Router()

router.get("/contents", getContents)

router.get("/topics", authHandler(true), getContentTree)

router.get("/topics/:id", getTopicTree)

router.post("/contents", authHandler(), createContent)

router.get("/contents/:id", getContent)

router.get("/contents/:id/history", getContentHistory)

export default router