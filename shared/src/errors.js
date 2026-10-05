// Turns Ajv's errors into messages in Portuguese. Each error gets the field's `key` (its path, like
// "config.answers.1"), its `label` and a short `message` ("máximo de 150 caracteres") that fits
// next to the field in a form; `describe` makes a full sentence of it for the API.

const TYPE_NAMES = {
  string: "um texto",
  integer: "um número inteiro",
  number: "um número",
  boolean: "verdadeiro ou falso",
  array: "uma lista",
  object: "um objeto"
}

const FORMAT_MESSAGES = {
  email: "email inválido",
  commit: "versão inválida",
  uuid: "identificador inválido",
  png: "imagem inválida"
}

const plural = (count, singular, plural) => `${count} ${count === 1 ? singular : plural}`

// `node` is the schema holding the keyword, for the keywords whose limit isn't in `params`
const MESSAGES = {
  required: () => "campo obrigatório",
  type: ({ type }) => `deve ser ${TYPE_NAMES[type] ?? type}`,
  // An empty string is a missing value as far as a person is concerned
  minLength: ({ limit }) => limit === 1 ? "campo obrigatório" : `mínimo de ${plural(limit, "caractere", "caracteres")}`,
  maxLength: ({ limit }) => `máximo de ${plural(limit, "caractere", "caracteres")}`,
  maxBytes: (_, node) => `excede o máximo de ${node.maxBytes} bytes`,
  minimum: ({ limit }) => `deve ser no mínimo ${limit}`,
  maximum: ({ limit }) => `deve ser no máximo ${limit}`,
  exclusiveMinimum: ({ limit }) => `deve ser maior que ${limit}`,
  minItems: ({ limit }) => `mínimo de ${plural(limit, "item", "itens")}`,
  maxItems: ({ limit }) => `máximo de ${plural(limit, "item", "itens")}`,
  uniqueItems: () => "não pode ter itens repetidos",
  enum: ({ allowedValues }) => `deve ser um destes: ${allowedValues.join(", ")}`,
  format: ({ format }) => FORMAT_MESSAGES[format] ?? "formato inválido",
  trimmed: () => "não pode começar ou terminar com espaços",
  notBlank: () => "campo obrigatório",
  additionalProperties: ({ additionalProperty }) => `campo desconhecido "${additionalProperty}"`
}

const decodePointer = segment => decodeURIComponent(segment).replace(/~1/g, "/").replace(/~0/g, "~")

// Ajv reports where in the schema each error comes from (`schemaPath`, a JSON pointer); walking it
// finds the schema holding the keyword and the closest `label` and `action` above it.
function resolve(rootSchema, schemaPath) {
  const segments = schemaPath.replace(/^#\/?/, "").split("/").filter(Boolean).map(decodePointer)
  segments.pop() // the keyword itself

  let node = rootSchema
  let { label, action } = rootSchema

  for (const segment of segments) {
    node = node?.[segment]
    if (node?.label) label = node.label
    if (node?.action) action = node.action
  }

  return { node: node ?? {}, label, action }
}

export function formatErrors(errors, rootSchema) {
  return (errors ?? [])
    .map(error => {
      const { keyword, params, instancePath, schemaPath } = error
      let { node, label, action } = resolve(rootSchema, schemaPath)
      const path = instancePath.split("/").slice(1).map(decodePointer)

      // A missing field is reported on its parent; point it at the field itself
      if (keyword === "required") {
        const field = node.properties?.[params.missingProperty]
        path.push(params.missingProperty)
        label = field?.label ?? label
        action = field?.action ?? action
      }

      const message = node.messages?.[keyword] ?? MESSAGES[keyword]?.(params, node) ?? "valor inválido"
      const key = path.join(".")

      return { key, label: label ?? key, message, action }
    })
    // allErrors may report the same problem twice for one field (e.g. minLength and notBlank)
    .filter((error, index, all) => all.findIndex(other => other.key === error.key && other.message === error.message) === index)
}

const capitalize = text => text.charAt(0).toUpperCase() + text.slice(1)

export const describe = error => `${capitalize(error.label)}: ${error.message}.`

// The first message for each field, as forms show them, e.g. { title: "campo obrigatório" }
export function fieldErrors(errors) {
  const fields = {}

  for (const { key, message } of errors)
    fields[key] ??= message

  return fields
}
