import { ValidationError } from "@/errors"
import { limits } from "@/validation"


// Requests are already validated against these limits (shared/); clamping again keeps every query
// bounded whoever calls it
const DEFAULT_PAGE_SIZE = limits.pageSize.default
const MAX_PAGE_SIZE = limits.pageSize.max
const MAX_PAGE = limits.page.max

// ORDER BY cannot be parameterized, so user supplied keys are translated through a
// whitelist of known SQL expressions instead of being interpolated into the query.
export function orderByColumn(key: string, columns: Record<string, string>): string {
  if (!Object.hasOwn(columns, key))
    throw new ValidationError({
      message: `Não é possível ordenar por "${key}".`,
      action: `Utilize um dos valores: ${Object.keys(columns).join(", ")}.`,
      stack: new Error().stack,
      errorLocationCode: "PAGINATION:ORDER_BY_COLUMN:INVALID_KEY",
      key: "orderBy"
    })

  return columns[key]
}

export function limitOffset(page: number, pageSize: number): string {
  const size = Math.min(Math.max(Math.trunc(pageSize) || DEFAULT_PAGE_SIZE, 1), MAX_PAGE_SIZE)
  const current = Math.min(Math.max(Math.trunc(page) || 1, 1), MAX_PAGE)

  return `LIMIT ${size} OFFSET ${(current - 1) * size}`
}
