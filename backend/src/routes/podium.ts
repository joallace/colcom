import { Router } from "express"

import { getPodiumContents, getPodiumUsers } from "@/controllers/podium"


const router = Router()

// Public, and the same for everyone: no viewer's interactions are included
router.get("/podium/users", getPodiumUsers)

router.get("/podium/contents", getPodiumContents)

export default router
