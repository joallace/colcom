import { mergeLimits } from "./limits.js"
import { createSchemas } from "./schemas.js"
import { addKeywords } from "./keywords.js"
import { formatErrors } from "./errors.js"


const OPTIONS = {
  allErrors: true,
  // Unknown keys are dropped (where a schema sets additionalProperties: false), so what's stored is
  // exactly what the schema describes
  removeAdditional: true,
  useDefaults: true,
  // Lets a value be compared with another one, like a critique's `to` with its `from`
  $data: true
}

// The Ajv options for each group of schemas: request bodies, and query strings and route parameters,
// which arrive as strings
export const GROUPS = {
  body: OPTIONS,
  query: { ...OPTIONS, coerceTypes: true }
}

// `compile(group, name, schema)` gives the validator function for a schema
function wrap(limits, compile) {
  const schemas = createSchemas(limits)

  const compiled = {}
  const validator = name => {
    if (!compiled[name]) {
      const group = Object.keys(GROUPS).find(group => Object.hasOwn(schemas[group], name))
      if (!group)
        throw new Error(`Unknown schema "${name}"`)

      compiled[name] = compile(group, name, schemas[group][name])
    }
    return compiled[name]
  }

  const validate = (name, data) => {
    const fn = validator(name)
    const valid = fn(data)

    return { valid, data, errors: valid ? [] : formatErrors(fn.errors, schemas.body[name] ?? schemas.query[name]) }
  }

  return { limits, schemas: { ...schemas.body, ...schemas.query }, validate }
}

// Builds the validators from an Ajv class (`import Ajv from "ajv"`), which each package installs, and
// optional limit overrides, e.g. createValidators(Ajv, { limits: { title: { max: 200 } } }).
// Schemas are compiled at runtime, on first use.
//
// validate(name, data) validates `data` in place: defaults are filled in, unknown keys removed and,
// for query schemas, strings converted to numbers. It returns { valid, data, errors }.
export function createValidators(Ajv, { limits: overrides } = {}) {
  const instances = Object.fromEntries(Object.entries(GROUPS).map(([group, options]) => [group, addKeywords(new Ajv(options), Ajv)]))

  return wrap(mergeLimits(overrides), (group, name, schema) => instances[group].compile(schema))
}

// The same validators from functions generated at build time (standalone.js), by schema name. The
// limits must be the ones they were generated with.
export function createPrecompiledValidators(functions, { limits: overrides } = {}) {
  return wrap(mergeLimits(overrides), (group, name) => {
    if (typeof functions[name] !== "function")
      throw new Error(`Schema "${name}" wasn't precompiled`)
    return functions[name]
  })
}
