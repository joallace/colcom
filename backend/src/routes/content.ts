import { Router } from "express"

import authHandler from "@/middleware/authHandler"
import { contentsLimit } from "@/middleware/rateLimit"
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
    mergePost,
    getMergeSides,
    rejectSuggestion
} from "@/controllers/content"


const router = Router()

router.get("/contents", authHandler(true), getContents)

router.get("/contents/bookmarked", authHandler(), getBookmarkedContent)

router.get("/topics", authHandler(true), getContentTree)

router.get("/topics/:id", authHandler(true), getTopicTree)

router.post("/contents", authHandler(), contentsLimit, createContent)

router.get("/contents/:id", authHandler(true), getContent)

router.get("/contents/:id/:hash", authHandler(true), getVersion)

router.get("/contents/:id/:hash/merge", authHandler(), getMergeSides)

router.post("/contents/:id/:hash/merge", authHandler(), mergePost)

router.post("/contents/:id/:hash/reject", authHandler(), rejectSuggestion)

router.post("/contents/:id/:hash/clone", authHandler(), contentsLimit, clonePost)

router.patch("/contents/:id", authHandler(), contentsLimit, updateContent)

export default router