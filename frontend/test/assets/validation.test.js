import { describe, expect, it } from "vitest"
import { DEFAULT_LIMITS } from "@colcom/shared"

import { formErrors, limits, responseErrors } from "@/assets/validation"


describe("formErrors", () => {
  it("is empty for a valid form", () => {
    expect(formErrors("clone", { title: "A copy" })).toEqual({})
  })

  it("reports an empty field as missing, not as too short", () => {
    expect(formErrors("clone", { title: "" })).toEqual({ title: "campo obrigatório" })
    expect(formErrors("clone", { title: "ab" })).toEqual({ title: `mínimo de ${limits.title.min} caracteres` })
  })

  it("names nested fields by their path", () => {
    expect(formErrors("topic", { title: "Should we?", config: { answers: ["sim", "x".repeat(limits.answer.max + 1)] } }))
      .toEqual({ "config.answers.1": `máximo de ${limits.answer.max} caracteres` })
  })
})

describe("responseErrors", () => {
  it("reads the API's list of errors", () => {
    const data = { key: "title", message: "Título: campo obrigatório.", errors: [{ key: "title", label: "título", message: "campo obrigatório" }, { key: "body", label: "texto", message: "campo obrigatório" }] }
    expect(responseErrors(data)).toEqual({ title: "campo obrigatório", body: "campo obrigatório" })
  })

  it("falls back to the single field an error names", () => {
    expect(responseErrors({ key: "name", message: 'O "name" informado já está sendo usado.' })).toEqual({ name: 'O "name" informado já está sendo usado.' })
    expect(responseErrors({ message: "Erro" })).toEqual({})
  })
})

it("uses the limits shared with the API", () => {
  expect(limits).toEqual(DEFAULT_LIMITS)
  expect(formErrors("signUp", { name: "a".repeat(DEFAULT_LIMITS.username.max + 1) }).name).toBe(`máximo de ${DEFAULT_LIMITS.username.max} caracteres`)
})
