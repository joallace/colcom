import { Router } from "express"

import authHandler from "@/middleware/authHandler"
import { loginLimit, signUpLimit } from "@/middleware/rateLimit"
import { createUser, getCurrentUser, getUser, getUsers, loginUser } from "@/controllers/user"


const router = Router()

router.get("/users", getUsers)

router.get("/users/self", authHandler(), getCurrentUser)

// After /users/self, which would otherwise be read as a name ("self" is reserved at sign up)
router.get("/users/:name", getUser)

router.post("/users", signUpLimit, createUser)

router.post("/login", loginLimit, loginUser)

export default router