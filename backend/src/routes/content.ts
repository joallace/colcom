import { Router } from "express"

import tokenHandler from "@/middleware/tokenHandler"
import { getContents, createContent, getContent, getContentHistory } from "@/controllers/content"


const router = Router()

router.use(tokenHandler)

router.get("/contents", getContents)

router.post("/contents", createContent)

router.get("/contents/:id", getContent)

router.get("/contents/:id/history", getContentHistory)

export default router