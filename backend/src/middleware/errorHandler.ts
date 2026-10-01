import { ErrorRequestHandler } from "express"

import { BaseError, InternalServerError, ValidationError } from "@/errors"
import logger from "@/logger"


// Only errors created by us are safe to expose. Anything else (e.g. a pg error, which carries
// table and constraint names) is logged and replaced by a generic one sharing the same errorId.
const toPublicError = (error: any): BaseError => {
  if (error instanceof BaseError)
    return error

  // Errors thrown by express itself, like a malformed JSON body, are marked as exposable
  if (error?.expose && error.statusCode < 500)
    return new ValidationError({ message: error.message, statusCode: error.statusCode })

  return new InternalServerError({})
}

const errorHandler: ErrorRequestHandler = (error, req, res, next) => {
  const publicError = toPublicError(error)

  if (publicError.statusCode >= 500)
    logger.error({ err: error, errorId: publicError.errorId }, `[errorHandler.ts] ${req.method} ${req.originalUrl}`)

  const { stack, ...body } = publicError
  res.status(publicError.statusCode).json(body)
}

export default errorHandler
