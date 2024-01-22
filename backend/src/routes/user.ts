import { Router } from "express"

import { createUser, getUsers, loginUser } from "@/controllers/user"


const router = Router()

router.get("/users", getUsers)

router.post("/users", createUser)

router.post("/login", loginUser)

export default router