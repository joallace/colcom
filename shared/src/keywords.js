// Custom keywords and formats used by the schemas. They are added to an Ajv instance given by the
// caller, so this package needs no dependency and each side uses its own copy of Ajv.
//
// Keywords are code generators rather than `validate` functions so they also work in standalone
// code (standalone.js), which the frontend runs without compiling anything in the browser.
// Formats can't be generated: standalone code imports them from this module.

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

// `Ajv` is the class, which carries the `_` template tag that builds generated code
export function addKeywords(ajv, Ajv) {
  const { _ } = Ajv
  if (typeof _ !== "function")
    throw new Error("addKeywords needs the Ajv class, which exports the `_` code template")

  // Annotations read by errors.js
  ajv.addVocabulary(["label", "messages", "action"])

  // cxt.fail(condition) reports an error, with this keyword and its schemaPath, when the condition
  // holds; a disabled boolean keyword generates nothing
  ajv.addKeyword({
    keyword: "trimmed",
    type: "string",
    schemaType: "boolean",
    code: cxt => cxt.schema && cxt.fail(_`${cxt.data} !== ${cxt.data}.trim()`)
  })

  ajv.addKeyword({
    keyword: "notBlank",
    type: "string",
    schemaType: "boolean",
    // trim() removes exactly what \s matches
    code: cxt => cxt.schema && cxt.fail(_`${cxt.data}.trim() === ""`)
  })

  ajv.addKeyword({
    keyword: "maxBytes",
    type: "string",
    schemaType: "number",
    code: cxt => cxt.fail(_`new TextEncoder().encode(${cxt.data}).length > ${cxt.schema}`)
  })

  for (const [name, format] of Object.entries(formats))
    ajv.addFormat(name, format)

  return ajv
}
