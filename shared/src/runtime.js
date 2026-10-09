// Ajv's runtime helpers that standalone code needs (see standalone.js)

// A string's length in code points, as JSON Schema counts it (a surrogate pair is one character).
// The same as ajv/dist/runtime/ucs2length.
export function ucs2length(value) {
  let length = 0

  for (let pos = 0; pos < value.length; length++) {
    const code = value.charCodeAt(pos++)
    // A high surrogate followed by a low one
    if (code >= 0xd800 && code <= 0xdbff && pos < value.length && (value.charCodeAt(pos) & 0xfc00) === 0xdc00)
      pos++
  }

  return length
}
