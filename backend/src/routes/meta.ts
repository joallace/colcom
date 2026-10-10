import { Router } from "express"

import authHandler from "@/middleware/authHandler"
import { getMeta } from "@/controllers/meta"


const router = Router()

router.get("/meta", authHandler(true), getMeta)

export default router
