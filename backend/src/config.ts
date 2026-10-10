import logger from "@/logger"


const MIN_SECRET_LENGTH = 32

const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET || ""

// Refusing to boot is safer than signing tokens with a guessable fallback secret,
// which would let anyone forge a session for any user.
if (accessTokenSecret.length < MIN_SECRET_LENGTH) {
  logger.fatal(`[config.ts] ACCESS_TOKEN_SECRET must be set and have at least ${MIN_SECRET_LENGTH} characters. Generate one with "openssl rand -hex 32".`)
  process.exit(1)
}

const isProduction = process.env.NODE_ENV === "production"

// The Vite dev server, so development works with no settings
const DEV_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"]

// Origins allowed to call the API from another origin. In production none by default: nginx serves
// the frontend and the API under the same origin, which needs no CORS.
export const parseOrigins = (value: string | undefined, production: boolean): string[] => {
  const origins = (value ?? "").split(",").map(origin => origin.trim().replace(/\/+$/, "")).filter(Boolean)
  return origins.length || production ? origins : DEV_ORIGINS
}

// Express' "trust proxy": which hops may set X-Forwarded-For. The default trusts only a proxy on
// the same machine (nginx with host networking), so a client reaching the port directly can't
// pick its own IP and dodge the rate limits.
export const parseTrustProxy = (value: string | undefined): boolean | number | string => {
  const setting = value?.trim()
  if (!setting)
    return "loopback"
  if (setting === "true" || setting === "false")
    return setting === "true"
  if (/^\d+$/.test(setting))
    return Number(setting)
  return setting
}

export interface RateLimit {
  max: number,
  windowMs: number
}

const UNITS: Record<string, number> = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }

// "<max>/<window>", e.g. "10/15m": at most 10 requests every 15 minutes. "0" or "off" disables it.
export const parseRateLimit = (name: string, value: string | undefined, fallback: string): RateLimit | null => {
  const setting = value?.trim() || fallback
  if (setting === "0" || setting === "off")
    return null

  const match = setting.match(/^(\d+)\/(\d+)([smhd])$/)
  if (!match || Number(match[1]) < 1 || Number(match[2]) < 1) {
    logger.fatal(`[config.ts] ${name} must look like "10/15m" (requests per window, in s, m, h or d), or be "off". Got "${setting}".`)
    process.exit(1)
  }

  return { max: Number(match[1]), windowMs: Number(match[2]) * UNITS[match[3]] }
}

// A whole number of at least `min`, or the fallback when unset
export const parseCount = (name: string, value: string | undefined, fallback: number, min = 0): number => {
  const setting = value?.trim()
  if (!setting)
    return fallback

  if (!/^\d+$/.test(setting) || Number(setting) < min) {
    logger.fatal(`[config.ts] ${name} must be a whole number of at least ${min}. Got "${setting}".`)
    process.exit(1)
  }

  return Number(setting)
}

export default Object.freeze({
  accessTokenSecret,
  corsOrigins: parseOrigins(process.env.CORS_ORIGIN, isProduction),
  trustProxy: parseTrustProxy(process.env.TRUST_PROXY),
  rateLimits: Object.freeze({
    // Failed logins per IP: guessing passwords
    login: parseRateLimit("RATE_LIMIT_LOGIN", process.env.RATE_LIMIT_LOGIN, "10/15m"),
    // Accounts per IP: mass sign-ups
    signUp: parseRateLimit("RATE_LIMIT_SIGN_UP", process.env.RATE_LIMIT_SIGN_UP, "5/1h"),
    // Topics, posts, critiques, edits and clones per user
    contents: parseRateLimit("RATE_LIMIT_CONTENTS", process.env.RATE_LIMIT_CONTENTS, "30/10m"),
    // Votes, bookmarks and promotions per user; toggling makes several per action
    interactions: parseRateLimit("RATE_LIMIT_INTERACTIONS", process.env.RATE_LIMIT_INTERACTIONS, "300/10m")
  }),
  // What keeps tags from being spammed: creating one is limited, using one is free
  tags: Object.freeze({
    // How old an account must be to create tags and to vote on other people's topics' tags
    minAccountDays: parseCount("TAG_MIN_ACCOUNT_DAYS", process.env.TAG_MIN_ACCOUNT_DAYS, 7),
    // New tags per user per day
    createPerDay: parseCount("TAG_CREATE_PER_DAY", process.env.TAG_CREATE_PER_DAY, 3, 1),
    // A new tag is provisional until it shows on this many topics, by at least two authors…
    activationTopics: parseCount("TAG_ACTIVATION_TOPICS", process.env.TAG_ACTIVATION_TOPICS, 3, 1),
    // …and expires if it isn't active after this many days
    provisionalDays: parseCount("TAG_PROVISIONAL_DAYS", process.env.TAG_PROVISIONAL_DAYS, 30, 1)
  })
})
