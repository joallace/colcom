import { Router } from "express"

import authHandler from "@/middleware/authHandler"
import { search } from "@/controllers/search"


const router = Router()

router.get("/search", authHandler(true), search)

export default router
