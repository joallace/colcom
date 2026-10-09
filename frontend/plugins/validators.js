// Precompiles the shared schemas (shared/) at build time with Ajv's standalone code, so the browser
// never compiles them with `new Function` and the CSP needs no 'unsafe-eval'.
// `import validators from "virtual:validators"` gives createPrecompiledValidators' result.
//
// The code is generated once per process: changes to shared/ need a restart of the dev server.

import Ajv from "ajv"
import standaloneCode from "ajv/dist/standalone/index.js"
import { standaloneModules } from "@colcom/shared/standalone"


const ID = "virtual:validators"
const RESOLVED = `\0${ID}`

export default function validators({ limits } = {}) {
  let modules

  return {
    name: "colcom-validators",

    resolveId(id) {
      if (id === ID || id.startsWith(`${ID}/`))
        return `\0${id}`
    },

    load(id) {
      if (id === RESOLVED)
        return [
          `import { createPrecompiledValidators } from "@colcom/shared"`,
          `import * as body from "${ID}/body"`,
          `import * as query from "${ID}/query"`,
          `export default createPrecompiledValidators({ ...body, ...query }, { limits: ${JSON.stringify(limits ?? {})} })`
        ].join("\n")

      if (id.startsWith(`${RESOLVED}/`)) {
        modules ??= standaloneModules(Ajv, standaloneCode, { limits })
        return modules[id.slice(RESOLVED.length + 1)]
      }
    }
  }
}
