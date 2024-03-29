import { Router } from "express"

import authHandler from "@/middleware/authHandler"
import {
    getContents,
    getBookmarkedContent,
    createContent,
    getContent,
    getContentTree,
    getTopicTree,
    updateContent,
    getVersion,
    clonePost,
    mergePost
} from "@/controllers/content"


const router = Router()

router.get("/contents", getContents)

router.get("/contents/bookmarked", authHandler(), getBookmarkedContent)

router.get("/topics", authHandler(true), getContentTree)

router.get("/topics/:id", authHandler(true), getTopicTree)

router.post("/contents", authHandler(), createContent)

router.get("/contents/:id", authHandler(true), getContent)

router.get("/contents/:id/:hash", authHandler(true), getVersion)

router.get("/contents/:id/:hash/merge", authHandler(), mergePost)

router.post("/contents/:id/:hash/clone", authHandler(), clonePost)

router.patch("/contents/:id", authHandler(), updateContent)

export default router