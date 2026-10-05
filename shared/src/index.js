import { DEFAULT_LIMITS, mergeLimits } from "./limits.js"
import { createSchemas } from "./schemas.js"
import { addKeywords, byteLength } from "./keywords.js"
import { formatErrors, describe, fieldErrors } from "./errors.js"


const OPTIONS = {
  allErrors: true,
  // Unknown keys are dropped (where a schema sets additionalProperties: false), so what's stored is
  // exactly what the schema describes
  removeAdditional: true,
  useDefaults: true,
  // Lets a value be compared with another one, like a critique's `to` with its `from`
  $data: true
}

// Builds the validators from an Ajv class (`import Ajv from "ajv"`), which each package installs, and
// optional limit overrides, e.g. createValidators(Ajv, { limits: { title: { max: 200 } } }).
//
// validate(name, data) validates `data` in place: defaults are filled in, unknown keys removed and,
// for query schemas, strings converted to numbers. It returns { valid, data, errors }.
export function createValidators(Ajv, { limits: overrides } = {}) {
  const limits = mergeLimits(overrides)
  const { body, query } = createSchemas(limits)
  const instances = {
    body: addKeywords(new Ajv(OPTIONS)),
    query: addKeywords(new Ajv({ ...OPTIONS, coerceTypes: true }))
  }

  const compiled = {}
  const compile = name => {
    if (!compiled[name]) {
      const group = Object.hasOwn(body, name) ? "body" : Object.hasOwn(query, name) ? "query" : undefined
      if (!group)
        throw new Error(`Unknown schema "${name}"`)

      compiled[name] = instances[group].compile(group === "body" ? body[name] : query[name])
    }
    return compiled[name]
  }

  const validate = (name, data) => {
    const validator = compile(name)
    const valid = validator(data)

    return { valid, data, errors: valid ? [] : formatErrors(validator.errors, validator.schema) }
  }

  return { limits, schemas: { ...body, ...query }, validate }
}

export { DEFAULT_LIMITS, mergeLimits, createSchemas, formatErrors, describe, fieldErrors, byteLength }
