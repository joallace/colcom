// Types for src/standalone.js, used at build time (see index.d.ts)
import type { AjvClass, LimitOverrides } from "./index.js"

export function standaloneModules(
  Ajv: AjvClass,
  standaloneCode: (ajv: any, refsOrFuncs?: Record<string, string>) => string,
  options?: { limits?: LimitOverrides, runtime?: string }
): { body: string, query: string }
