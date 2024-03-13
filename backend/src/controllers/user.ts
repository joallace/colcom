import { RequestHandler } from "express"
import { compare } from "bcryptjs"
import jwt from "jsonwebtoken"

import User, { UserInsertRequest } from "@/models/user"
import Interactions from "@/models/interactions"
import { ValidationError } from "@/errors"


const validateUser = (content: UserInsertRequest) => {
  const mandatory = ["name", "pass", "email"]

  for (const field of mandatory)
    if (!content[field])
      throw new ValidationError({
        message: `"${field}" é um campo obrigatório`,
        errorLocationCode: "CONTROLLER:USER:VALIDADE_CONTENT"
      })
}

export const createUser: RequestHandler = async (req, res, next) => {
  const { name, pass, email } = req.body

  try {
    const user: UserInsertRequest = { name, pass, email }

    validateUser(user)

    const result = await User.create(user)

    res.status(201).json(result)
  }
  catch (err) {
    next(err)
  }
}

// Maybe will be used for a leaderboard
export const getUsers: RequestHandler = async (req, res, next) => {
  const page = Number(req.query.page) || 1
  const pageSize = Number(req.query.pageSize) || 10
  const orderBy = req.query.orderBy ? String(req.query.orderBy) : "id"

  try {
    const contents = await User.findAll({ page, pageSize, orderBy })
    res.status(200).json(contents)
  }
  catch (err) {
    next(err)
  }
}

export const loginUser: RequestHandler = async (req, res, next) => {
  const { login, pass } = req.body

  try {
    const user = await User.findByLogin(login, { hideSensitiveInfo: false })

    if (user && (await compare(pass, user.pass))) {
      const accessToken = jwt.sign(
        {
          user: {
            username: user.name,
            email: user.email,
            pid: user.pid,
          },
        },
        process.env.ACCESS_TOKEN_SECRET || "colcom",
        { expiresIn: "7d" }
      );
      res.status(200).json({ accessToken });
    } else
      throw new ValidationError({
        message: "Combinação de login e senha inválida."
      })
  }
  catch (err) {
    next(err)
  }
}

export const getCurrentUser: RequestHandler = async (req, res, next) => {
  const public_id = (<any>req.params.user).pid
  try {
    const user = await User.findByPid(public_id)
    const promoting = (await Interactions.getUserCurrentPromote(user.pid))?.content_id
    res.status(200).json({ ...user, promoting })
  }
  catch (err) {
    next(err)
  }
}