import Ajv from "ajv"
import { createValidators, describe, fieldErrors } from "@colcom/shared"


// The same schemas the API validates requests with (shared/), so a form refuses exactly what the API
// would, with the same messages
export const { validate, limits } = createValidators(Ajv)

export { describe }

// Validates a form and returns its errors by field ({ title: "campo obrigatório" }), empty when it's
// valid. A field left empty is reported as missing rather than as too short.
export function formErrors(schema, values) {
  const filled = Object.fromEntries(Object.entries(values).filter(([, value]) => value !== "" && value !== undefined))
  return fieldErrors(validate(schema, filled).errors)
}

// The errors by field of an API response; the API names a single field (`key`) for errors found
// outside the schemas, like a name already in use
export function responseErrors(data) {
  if (data?.errors)
    return fieldErrors(data.errors)

  return data?.key ? { [data.key]: data.message } : {}
}
