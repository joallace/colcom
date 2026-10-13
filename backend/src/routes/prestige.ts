import { Router } from "express"

import { getPrestigeRules, getUserPrestige } from "@/controllers/prestige"


const router = Router()

// Public: prestige is shown on the podium and on every profile
router.get("/prestige", getPrestigeRules)

router.get("/users/:name/prestige", getUserPrestige)

export default router
