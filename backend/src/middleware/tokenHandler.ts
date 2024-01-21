import { UnauthorizedError, ValidationError } from "@/errors"
import { RequestHandler, Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"


const tokenHandler: RequestHandler = async (req, res, next) => {
  const authHeader = String(req.headers.Authorization) || String(req.headers.authorization)

  try {
    if (!authHeader?.startsWith("Bearer")){
      next()
      return
    }

    const token = authHeader.split(" ")[1]

    if (!token)
      throw new ValidationError({
        message: "Token de autorização não fornecido.",
        action: "Tente logar novamente ou insira um token válido."
      })

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET || "colcom", (err, decoded) => {
      if (err)
        throw new UnauthorizedError({ message: "Token inválido" })

      req.params.user = (<any>decoded).user
      next()
    })
  }
  catch (err) {
    next(err)
  }
}

export default tokenHandler
