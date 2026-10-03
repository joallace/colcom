import { UnauthorizedError, ValidationError } from "@/errors"
import { RequestHandler } from "express"
import jwt from "jsonwebtoken"

import config from "@/config"


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

    jwt.verify(token, config.accessTokenSecret, (err, decoded) => {
      if (err)
        throw new UnauthorizedError({ message: "Token inválido" })

      // res.locals is express' place for data scoped to the current request
      res.locals.user = (<any>decoded).user
      next()
    })
  }
  catch (err) {
    next(err)
  }
}

export default tokenHandler
