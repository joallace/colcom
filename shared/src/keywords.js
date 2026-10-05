// Custom keywords and formats used by the schemas. They are added to an Ajv instance given by the
// caller, so this package needs no dependency and each side uses its own copy of Ajv.

const encoder = new TextEncoder()

const BASE64 = /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/
// The PNG signature (\x89PNG\r\n\x1a\n) in base64
const PNG_SIGNATURE = "iVBORw0KGgo"

export const formats = {
  email: /^[^\s@]+@(?:[^\s@.]+\.)+[^\s@.]{2,}$/,
  // Hashes reach git as arguments, where a value like "--output=…" would be read as an option
  commit: /^[0-9a-f]{7,40}$/,
  uuid: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
  png: value => value.startsWith(PNG_SIGNATURE) && BASE64.test(value)
}

export const byteLength = value => encoder.encode(value).length

export function addKeywords(ajv) {
  // Annotations read by errors.js
  ajv.addVocabulary(["label", "messages", "action"])

  ajv.addKeyword({
    keyword: "trimmed",
    type: "string",
    schemaType: "boolean",
    validate: (enabled, value) => !enabled || value === value.trim()
  })

  ajv.addKeyword({
    keyword: "notBlank",
    type: "string",
    schemaType: "boolean",
    validate: (enabled, value) => !enabled || /\S/.test(value)
  })

  ajv.addKeyword({
    keyword: "maxBytes",
    type: "string",
    schemaType: "number",
    validate: (max, value) => byteLength(value) <= max
  })

  for (const [name, format] of Object.entries(formats))
    ajv.addFormat(name, format)

  return ajv
}
