import { Router } from "express"

import authHandler from "@/middleware/authHandler"
import { getContents, createContent, getContent, getContentHistory, getContentTree } from "@/controllers/content"


const router = Router()

router.get("/contents", getContents)

router.get("/topics", getContentTree)

router.post("/contents", authHandler, createContent)

router.get("/contents/:id", getContent)

router.get("/contents/:id/history", getContentHistory)

export default router