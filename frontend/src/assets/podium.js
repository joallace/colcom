// The podium (GET /podium/*): its address, what it ranks over which period, and the words that
// explain its rule

import { PODIUM_PERIODS } from "@colcom/shared"

// What the second column ranks, the first by default; `none` starts the sentence saying nothing is
export const PODIUM_TYPES = [
  { value: "topic", label: "tópicos", none: "nenhum tópico" },
  { value: "post", label: "posts", none: "nenhum post" }
]

// Over which period, the first by default (their lengths are the API's, in shared/src/podium.js)
export const PODIUM_PERIOD_OPTIONS = [
  { value: "week", label: "semana" },
  { value: "month", label: "mês" },
  { value: "all", label: "sempre" }
]

const DEFAULT_TYPE = PODIUM_TYPES[0].value
const DEFAULT_PERIOD = PODIUM_PERIOD_OPTIONS[0].value

// The type and period the address asks for; an unknown one is the default
export function podiumParams(params) {
  const known = (options, value) => options.some(option => option.value === value)
  return {
    type: known(PODIUM_TYPES, params.get("type")) ? params.get("type") : DEFAULT_TYPE,
    period: known(PODIUM_PERIOD_OPTIONS, params.get("period")) ? params.get("period") : DEFAULT_PERIOD
  }
}

// The podium's address, leaving the defaults out
export function podiumPath({ type = DEFAULT_TYPE, period = DEFAULT_PERIOD } = {}) {
  const params = new URLSearchParams()
  if (type !== DEFAULT_TYPE)
    params.set("type", type)
  if (period !== DEFAULT_PERIOD)
    params.set("period", period)

  const query = params.toString()
  return query ? `/podium?${query}` : "/podium"
}

// When the counted votes were cast: "nos últimos 7 dias", or "desde o início"
export function periodPhrase(period) {
  const days = PODIUM_PERIODS[period]
  return days ? `nos últimos ${days} dias` : "desde o início"
}

export const ordinal = position => `${position}º`

// Only positive balances are ranked
export const scoreText = score => `+${score}`

// What a score is made of, as the relevance metric says it: "3 acharam relevante, 1 não"
export const votesText = ({ upvotes, downvotes }) =>
  `${upvotes} ${upvotes === 1 ? "achou" : "acharam"} relevante, ${downvotes} não`
