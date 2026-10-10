import Ajv from "ajv"
import { createValidators, describe, SchemaData, SchemaName } from "@colcom/shared"

import { ValidationError } from "@/errors"


// The same schemas the frontend validates its forms with (shared/), so both agree on every rule
const validators = createValidators(Ajv)

export const limits = validators.limits

// Validates a copy of `data` (a request's body, query or params) and returns it with defaults filled
// in, unknown keys removed and, for query schemas, numbers parsed. Throws a ValidationError naming
// the first problem, with every problem in `errors`.
export function validate<Name extends SchemaName>(name: Name, data: unknown): SchemaData[Name] {
  // Express 5 parses req.query again on every access, so changes to it would be lost anyway
  const { valid, data: result, errors } = validators.validate(name, structuredClone(data ?? {}))

  if (!valid) {
    const [first] = errors
    throw new ValidationError({
      message: describe(first),
      action: first.action,
      errorLocationCode: `VALIDATION:${name.toUpperCase()}`,
      key: first.key,
      errors: errors.map(({ key, label, message }) => ({ key, label, message }))
    })
  }

  return result
}
