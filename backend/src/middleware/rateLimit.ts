import { RequestHandler } from "express"
import { ipKeyGenerator, rateLimit } from "express-rate-limit"

import config, { RateLimit } from "@/config"
import { TooManyRequestsError } from "@/errors"


interface LimiterOptions {
  message: string,
  // Count only requests that fail, so a user who logs in normally never reaches the limit
  onlyFailures?: boolean
}

const passThrough: RequestHandler = (req, res, next) => next()

// The memory store keeps counts in this process: enough for one backend, as compose runs it.
// More than one instance would need a shared store (e.g. Postgres or Redis).
const limiter = (limit: RateLimit | null, { message, onlyFailures = false }: LimiterOptions): RequestHandler => {
  if (!limit)
    return passThrough

  return rateLimit({
    ...limit,
    limit: limit.max,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    skipSuccessfulRequests: onlyFailures,
    // Placed after authHandler, it counts per user, so people behind one address (a school, a
    // city hall's network) don't share a limit. Otherwise per IP, grouping an IPv6 /56, which
    // one client usually owns whole.
    keyGenerator: (req, res) => res.locals.user?.pid ? `user:${res.locals.user.pid}` : `ip:${ipKeyGenerator(req.ip ?? "")}`,
    handler: (req, res, next) => next(new TooManyRequestsError({
      message,
      action: "Aguarde alguns minutos e tente novamente."
    }))
  })
}

const { rateLimits } = config

export const loginLimit = limiter(rateLimits.login, {
  message: "Muitas tentativas de login sem sucesso.",
  onlyFailures: true
})

export const signUpLimit = limiter(rateLimits.signUp, {
  message: "Muitas contas criadas a partir deste endereço."
})

export const contentsLimit = limiter(rateLimits.contents, {
  message: "Você publicou ou editou muitas vezes em pouco tempo."
})

export const interactionsLimit = limiter(rateLimits.interactions, {
  message: "Você interagiu muitas vezes em pouco tempo."
})
