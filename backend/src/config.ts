import logger from "@/logger"


const MIN_SECRET_LENGTH = 32

const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET || ""

// Refusing to boot is safer than signing tokens with a guessable fallback secret,
// which would let anyone forge a session for any user.
if (accessTokenSecret.length < MIN_SECRET_LENGTH) {
  logger.fatal(`[config.ts] ACCESS_TOKEN_SECRET must be set and have at least ${MIN_SECRET_LENGTH} characters. Generate one with "openssl rand -hex 32".`)
  process.exit(1)
}

export default Object.freeze({
  accessTokenSecret
})
