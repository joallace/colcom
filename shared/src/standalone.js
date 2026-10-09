// Ajv's standalone code: the validators as JavaScript source, generated at build time, so a page can
// validate without compiling schemas with `new Function` (which a CSP without 'unsafe-eval' forbids).
// The frontend's build turns this source into modules and hands their exports to
// createPrecompiledValidators.

import { createSchemas } from "./schemas.js"
import { addKeywords } from "./keywords.js"
import { mergeLimits } from "./limits.js"
import { GROUPS } from "./validators.js"

// Ajv's generated code requires these runtime helpers through CommonJS; they are imported from this
// package instead, so the browser bundle needs no CommonJS interop (or Ajv at all)
const RUNTIME = {
  "ajv/dist/runtime/ucs2length": "ucs2length"
}

// Returns { body, query }: the source of an ES module per Ajv instance, each exporting one validator
// per schema name. `Ajv` is the class and `standaloneCode` the default export of
// "ajv/dist/standalone"; `runtime` is how the generated modules import this package.
export function standaloneModules(Ajv, standaloneCode, { limits: overrides, runtime = "@colcom/shared" } = {}) {
  const schemas = createSchemas(mergeLimits(overrides))

  return Object.fromEntries(Object.keys(GROUPS).map(group => {
    const ajv = addKeywords(new Ajv({
      ...GROUPS[group],
      code: { source: true, esm: true, formats: Ajv._`formats` }
    }), Ajv)

    for (const [name, schema] of Object.entries(schemas[group]))
      ajv.addSchema(schema, name)

    const names = Object.keys(schemas[group])
    const source = standaloneCode(ajv, Object.fromEntries(names.map(name => [name, name])))
      .replace(/require\("([^"]+)"\)\.default/g, (_, path) => {
        if (!RUNTIME[path])
          throw new Error(`Standalone code requires "${path}", which runtime.js doesn't provide`)
        return RUNTIME[path]
      })

    if (/\brequire\(/.test(source))
      throw new Error("Standalone code still has a require()")

    return [group, `import { formats, ${Object.values(RUNTIME).join(", ")} } from ${JSON.stringify(runtime)};\n${source}`]
  }))
}
