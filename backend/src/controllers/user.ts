import { RequestHandler } from "express"
import bcrypt from "bcryptjs"
import jwt from "jsonwebtoken"

import User, { UserInsertRequest } from "@/models/user"
import Interactions from "@/models/interactions"
import { ValidationError } from "@/errors"
import config from "@/config"
import { validate } from "@/validation"


export const createUser: RequestHandler = async (req, res, next) => {
  try {
    const user: UserInsertRequest = validate("signUp", req.body)
    const result = await User.create(user)

    res.status(201).json(result)
  }
  catch (err) {
    next(err)
  }
}

// Maybe will be used for a leaderboard
export const getUsers: RequestHandler = async (req, res, next) => {
  try {
    const { page, pageSize, orderBy } = validate("list", req.query)
    const contents = await User.findAll({ page, pageSize, orderBy })
    res.status(200).json(contents)
  }
  catch (err) {
    next(err)
  }
}

export const loginUser: RequestHandler = async (req, res, next) => {
  try {
    const { login, pass } = validate("login", req.body)
    const user = await User.findByLogin(login, { hideSensitiveInfo: false })

    if (user && (await bcrypt.compare(pass, user.pass))) {
      const accessToken = jwt.sign(
        {
          user: {
            username: user.name,
            email: user.email,
            pid: user.pid,
          },
        },
        config.accessTokenSecret,
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

// Anyone's public profile; their contents come from GET /contents?authorId=<pid>
export const getUser: RequestHandler = async (req, res, next) => {
  try {
    const { name } = validate("userParams", req.params)
    const { pid, name: userName, avatar, created_at } = await User.findByName(name)
    res.status(200).json({ pid, name: userName, avatar, created_at })
  }
  catch (err) {
    next(err)
  }
}

export const getCurrentUser: RequestHandler = async (req, res, next) => {
  const public_id = res.locals.user.pid
  try {
    const user = await User.findByPid(public_id)
    const promoting = (await Interactions.getUserCurrentPromote(user.pid))?.content_id
    res.status(200).json({ ...user, promoting })
  }
  catch (err) {
    next(err)
  }
}
