import { describe, expect, it } from "vitest"
import Ajv from "ajv"
import { createValidators, DEFAULT_LIMITS, describe as describeError, fieldErrors } from "@colcom/shared"

import { validate } from "@/validation"
import { ValidationError } from "@/errors"


const { validate: check } = createValidators(Ajv)

const PNG = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
const user = { name: "alice", email: "alice@colcom.museum", pass: "correct horse", avatar: PNG }
const critique = {
  title: "Disagree",
  parent_id: 2,
  body: "<p>No.</p>",
  config: { commit: "abc1234", from: 1, to: 6, quote: { exact: "First", prefix: "", suffix: " paragraph.", start: 0 } }
}

describe("shared schemas", () => {
  it("accept valid requests", () => {
    expect(check("signUp", { ...user }).valid).toBe(true)
    expect(check("critique", structuredClone(critique)).valid).toBe(true)
    expect(check("topic", { title: "Should we?", config: { answers: ["sim", "não"] } }).valid).toBe(true)
  })

  it("report every problem, with the field's key and a message in Portuguese", () => {
    const { valid, errors } = check("signUp", { name: " al@", email: "nope", pass: "short", avatar: "abc" })

    expect(valid).toBe(false)
    expect(fieldErrors(errors)).toEqual({
      name: 'não pode conter "@"',
      email: "email inválido",
      pass: `mínimo de ${DEFAULT_LIMITS.password.min} caracteres`,
      avatar: "imagem inválida"
    })
    expect(describeError(errors[0])).toBe('Nome de usuário: não pode conter "@".')
  })

  it("point a missing field at the field itself, with its label", () => {
    const [error] = check("clone", {}).errors
    expect(error).toMatchObject({ key: "title", label: "título", message: "campo obrigatório" })
  })

  it("name nested fields by their path and inherit the closest label and action", () => {
    const { errors } = check("critique", { ...critique, config: { ...critique.config, from: 6, to: 1 } })

    expect(errors).toEqual([{ key: "config.to", label: "trecho criticado", message: "deve ser maior que 6", action: "Selecione um trecho de texto do post e tente novamente." }])
  })

  it("drop unknown keys and fill in defaults", () => {
    const { data } = check("topic", { title: "Should we?", evil: true })
    expect(data).toEqual({ title: "Should we?", config: { answers: [] } })

    const critiqueData = check("critique", { ...structuredClone(critique), config: { ...critique.config, extra: 1 } }).data
    expect(critiqueData.config).toEqual(critique.config)
  })

  it("take a topic's answers open (none) or at least two, all different", () => {
    const answers = (list: string[]) => check("topic", { title: "Should we?", config: { answers: list } })

    expect(answers([]).valid).toBe(true)
    expect(answers(["sim"]).errors[0]).toMatchObject({ key: "config.answers", message: "defina ao menos 2 respostas, ou nenhuma" })
    expect(answers(["sim", "sim"]).errors[0]).toMatchObject({ message: "as respostas devem ser diferentes" })
    expect(answers(Array.from({ length: 11 }, (_, i) => `a${i}`)).errors[0]).toMatchObject({ message: "máximo de 10 itens" })
  })

  it("measure passwords in bytes, as bcrypt does", () => {
    const max = DEFAULT_LIMITS.password.maxBytes
    expect(check("login", { login: "alice", pass: "a".repeat(max) }).valid).toBe(true)
    // 2 bytes each in UTF-8: within the length, over bcrypt's limit
    expect(check("login", { login: "alice", pass: "é".repeat(max / 2 + 1) }).errors[0]).toMatchObject({ key: "pass" })
  })

  it("refuse surrounding whitespace in titles and blank bodies", () => {
    expect(check("clone", { title: " Padded " }).errors[0].message).toBe("não pode começar ou terminar com espaços")
    expect(check("edit", { body: "   ", message: "fix" }).errors[0]).toMatchObject({ key: "body", message: "campo obrigatório" })
  })

  it("refuse commits git would read as options", () => {
    expect(check("versionParams", { id: "1", hash: "--output=/tmp/x" }).errors[0]).toMatchObject({ key: "hash", message: "versão inválida" })
  })

  it("parse query strings and route parameters, with defaults", () => {
    expect(check("list", { page: "3", with_count: "" }).data).toEqual({ page: 3, pageSize: DEFAULT_LIMITS.pageSize.default, orderBy: "id", with_count: "" })
    expect(check("contentParams", { id: "12" }).data).toEqual({ id: 12 })
    expect(check("contentParams", { id: "12abc" }).valid).toBe(false)
    expect(check("notifications", { unread: "true", page: "2" }).data).toEqual({ page: 2, pageSize: DEFAULT_LIMITS.pageSize.default, unread: true })
    expect(check("notifications", {}).data).toMatchObject({ unread: false })
    // Request bodies are JSON: their numbers aren't parsed from strings
    expect(check("interaction", { content_id: "12", type: "up" }).valid).toBe(false)
  })

  it("take other limits", () => {
    const { validate: custom, limits } = createValidators(Ajv, { limits: { title: { max: 5 } } })

    expect(limits.title).toEqual({ min: DEFAULT_LIMITS.title.min, max: 5 })
    expect(custom("clone", { title: "Too long" }).errors[0].message).toBe("máximo de 5 caracteres")
    expect(check("clone", { title: "Too long" }).valid).toBe(true)
  })
})

describe("validate", () => {
  it("returns the validated copy, leaving the original untouched", () => {
    const query = { page: "2" }
    expect(validate("list", query)).toMatchObject({ page: 2, pageSize: 10 })
    expect(query).toEqual({ page: "2" })
  })

  it("throws a ValidationError naming the first problem, with all of them", () => {
    try {
      validate("signUp", {})
      expect.unreachable()
    }
    catch (err: any) {
      expect(err).toBeInstanceOf(ValidationError)
      expect(err).toMatchObject({ statusCode: 400, key: "name", message: "Nome de usuário: campo obrigatório.", errorLocationCode: "VALIDATION:SIGNUP" })
      expect(err.errors.map((error: any) => error.key)).toEqual(["name", "email", "pass", "avatar"])
    }
  })
})
