import { ErrorRequestHandler } from "express";

const errorHandler: ErrorRequestHandler = async (error, req, res, next) => {
  res.status(error?.statusCode || 500).json(error)
}

export default errorHandler