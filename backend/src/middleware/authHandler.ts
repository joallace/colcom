import { UnauthorizedError, ValidationError } from "@/errors"
import { RequestHandler } from "express"
import jwt from "jsonwebtoken"

import config from "@/config"
import User from "@/models/user"


// Optional routes still refuse a token that is invalid, expired or revoked rather than serving the
// request anonymously: a client that sends one believes it's logged in, and the 401 tells it to
// log out instead of showing anonymous data as the user's.
const tokenHandler = (optional = false): RequestHandler => async (req, res, next) => {
  const authHeader = String(req.headers.Authorization || req.headers.authorization)

  try {
    if (!authHeader?.startsWith("Bearer ") && !optional) {
      throw new ValidationError({
        message: "Token de autorização não fornecido.",
        action: "Tente logar novamente ou insira um token válido."
      })
    }

    const token = authHeader.split(" ")[1]

    if (!token) {
      if (optional)
        return next()
      else
        throw new ValidationError({
          message: "Token de autorização não fornecido.",
          action: "Tente logar novamente ou insira um token válido."
        })
    }

    let decoded: any
    try {
      decoded = jwt.verify(token, config.accessTokenSecret)
    }
    catch {
      throw new UnauthorizedError({ message: "Token inválido" })
    }

    // Logging out raises the user's version, revoking every token signed with an older one
    const current = await User.tokenVersion(decoded.user?.pid)
    if (current === undefined || decoded.ver !== current)
      throw new UnauthorizedError({
        message: "Sessão encerrada.",
        action: "Faça login novamente."
      })

    // res.locals is express' place for data scoped to the current request
    res.locals.user = decoded.user
    next()
  }
  catch (err) {
    next(err)
  }
}

export default tokenHandler
