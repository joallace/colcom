import { Router } from "express"

import authHandler from "@/middleware/authHandler"
import { createUser, getCurrentUser, getUsers, loginUser } from "@/controllers/user"


const router = Router()

router.get("/users", getUsers)

router.get("/users/self", authHandler, getCurrentUser)

router.post("/users", createUser)

router.post("/login", loginUser)

export default router