import { Router } from "express"

import authHandler from "@/middleware/authHandler"
import { getContents, createContent, getContent, getContentTree, getTopicTree, updateContent, getVersion } from "@/controllers/content"


const router = Router()

router.get("/contents", getContents)

router.get("/topics", authHandler(true), getContentTree)

router.get("/topics/:id", authHandler(true), getTopicTree)

router.post("/contents", authHandler(), createContent)

router.get("/contents/:id", authHandler(true), getContent)

router.get("/contents/:id/:hash", authHandler(true), getVersion)

router.patch("/contents/:id", authHandler(), updateContent)

export default router