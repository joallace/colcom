import { Router } from "express"

import authHandler from "@/middleware/authHandler"
import { loginLimit, signUpLimit } from "@/middleware/rateLimit"
import { createUser, getCurrentUser, getUser, getUsers, loginUser, logoutUser } from "@/controllers/user"


const router = Router()

router.get("/users", getUsers)

router.get("/users/self", authHandler(), getCurrentUser)

// After /users/self, which would otherwise be read as a name ("self" is reserved at sign up)
router.get("/users/:name", getUser)

router.post("/users", signUpLimit, createUser)

router.post("/login", loginLimit, loginUser)

// Needs a valid token, so it can only revoke its own user's sessions; no limit beyond that
router.post("/logout", authHandler(), logoutUser)

export default router