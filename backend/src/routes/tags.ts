import { Router } from "express"

import authHandler from "@/middleware/authHandler"
import { interactionsLimit } from "@/middleware/rateLimit"
import { getTags, getTagIntersection, voteOnTag, getTagHistory } from "@/controllers/tags"


const router = Router()

router.get("/tags", getTags)

router.get("/tags/:slugs", getTagIntersection)

router.post("/topics/:id/tags", authHandler(), interactionsLimit, voteOnTag)

router.get("/topics/:id/tags/history", getTagHistory)

export default router
