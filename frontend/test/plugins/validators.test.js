import { describe, expect, it, vi } from "vitest"
import Ajv from "ajv"
import standaloneCode from "ajv/dist/standalone/index.js"
import { createValidators, ucs2length } from "@colcom/shared"
import { standaloneModules } from "@colcom/shared/standalone"
import ucs2lengthAjv from "ajv/dist/runtime/ucs2length.js"

import validators from "virtual:validators"


// What the API compiles at runtime; the frontend's precompiled validators must agree with it
const runtime = createValidators(Ajv)

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
const critiqueConfig = { commit: "abc1234", from: 1, to: 6, quote: { exact: "First", prefix: "", suffix: " paragraph.", start: 0 } }

const CASES = [
  ["signUp", { name: "alice", email: "alice@colcom.museum", pass: "correct horse", avatar: PNG }],
  ["signUp", { name: " al@", email: "nope", pass: "short", avatar: "abc", extra: 1 }],
  ["signUp", { name: "self", email: "a@b.co", pass: "é".repeat(37), avatar: PNG.slice(0, -2) }],
  ["signUp", {}],
  ["login", { login: "alice", pass: "a".repeat(72) }],
  ["login", { login: "", pass: "a".repeat(73) }],
  ["topic", { title: "Should we?", evil: true }],
  ["topic", { title: " Padded ", config: { answers: ["sim"] } }],
  ["topic", { title: "Should we?", config: { answers: ["sim", "sim", " não"], other: 1 } }],
  ["topic", { title: "Should we?", config: { answers: Array.from({ length: 11 }, (_, i) => `a${i}`) } }],
  ["post", { title: "A post", parent_id: 1, body: "<p>Hi</p>", config: { answer: "sim" } }],
  ["post", { title: "A post", parent_id: 0, body: "   " }],
  ["critique", { title: "Disagree", parent_id: 2, body: "<p>No.</p>", config: critiqueConfig }],
  ["critique", { title: "Disagree", parent_id: 2, body: "<p>No.</p>", config: { ...critiqueConfig, from: 6, to: 1, commit: "--output=x" } }],
  ["critique", { title: "Disagree", parent_id: 2, body: "x", config: { ...critiqueConfig, quote: { ...critiqueConfig.quote, exact: " \n " } } }],
  ["edit", { body: "<p>x</p>", message: "fix " }],
  ["clone", { title: "ab" }],
  // Emoji are one character each (a surrogate pair), as in the API
  ["clone", { title: "🙂".repeat(150) }],
  ["clone", { title: "🙂".repeat(151) }],
  ["interaction", { content_id: "12", type: "up" }],
  ["interaction", { content_id: 12, type: "sideways" }],
  ["readNotifications", { ids: [1, 1] }],
  ["list", { page: "3", with_count: "", authorId: "not-a-uuid" }],
  ["list", { page: "0", pageSize: "1000", orderBy: "" }],
  ["notifications", { unread: "true", page: "2", extra: "x" }],
  ["contentParams", { id: "12abc" }],
  ["versionParams", { id: "1", hash: "abcdef0" }],
  ["userParams", { name: "self" }]
]

describe("precompiled validators", () => {
  it.each(CASES)("agree with Ajv compiled at runtime on %s %j", (name, data) => {
    expect(validators.validate(name, structuredClone(data))).toEqual(runtime.validate(name, structuredClone(data)))
  })

  it("never compile anything, so they run under a CSP without 'unsafe-eval'", () => {
    const fresh = createValidators(Ajv)
    vi.stubGlobal("Function", function () { throw new EvalError("Function is forbidden") })

    expect(() => fresh.validate("clone", { title: "A copy" })).toThrow(EvalError)
    for (const [name, data] of CASES)
      expect(() => validators.validate(name, structuredClone(data))).not.toThrow()
  })

  it("cover every schema", () => {
    for (const name of Object.keys(runtime.schemas))
      expect(() => validators.validate(name, {})).not.toThrow()
  })

  it("are plain ES modules, importing Ajv's runtime helpers from shared/", () => {
    const { body, query } = standaloneModules(Ajv, standaloneCode)

    for (const source of [body, query]) {
      expect(source).not.toMatch(/\brequire\(|new Function|\beval\(/)
      expect(source).toMatch(/^import \{ formats, ucs2length \} from "@colcom\/shared";/)
    }
  })
})

it("ucs2length counts like Ajv's", () => {
  const ajvLength = ucs2lengthAjv.default ?? ucs2lengthAjv
  for (const text of ["", "abc", "🙂🙂", "a\ud83d", "\ud83d", "\ude42a", "é👩‍👩‍👧"])
    expect(ucs2length(text)).toBe(ajvLength(text))
})
