import { describe, expect, it } from "vitest"

import * as errors from "@/errors"


describe("error classes", () => {
  it.each([
    ["InternalServerError", 500],
    ["NotFoundError", 404],
    ["ServiceError", 503],
    ["ValidationError", 400],
    ["UnauthorizedError", 401],
    ["ForbiddenError", 403],
    ["ConflictError", 409],
    ["TooManyRequestsError", 429],
    ["UnprocessableEntityError", 422],
  ] as const)("%s has status %i and a default message and action in Portuguese", (name, status) => {
    const error = new errors[name]({})

    expect(error).toBeInstanceOf(errors.BaseError)
    expect(error).toBeInstanceOf(Error)
    expect(error.name).toBe(name)
    expect(error.statusCode).toBe(status)
    expect(error.message).toMatch(/\S/)
    expect(error.action).toMatch(/\S/)
    expect(error.errorId).toMatch(/^[0-9a-f-]{36}$/)
  })

  it("lets validation errors carry another status", () => {
    expect(new errors.ValidationError({ statusCode: 409 }).statusCode).toBe(409)
  })

  it("keeps the given message, key and location", () => {
    const error = new errors.ValidationError({ message: "Inválido.", key: "title", errorLocationCode: "HERE" })
    expect(error).toMatchObject({ message: "Inválido.", key: "title", errorLocationCode: "HERE" })
  })

  // errorHandler sends the error's own enumerable fields; the frontend reads some (e.g. `name`)
  it("serialises the same fields, in the same order, as the response body", () => {
    const error = new errors.ValidationError({
      message: "Inválido.", key: "title", errorLocationCode: "HERE", errorId: "id",
      errors: [{ key: "title", label: "Título", message: "obrigatório" }]
    })
    const { stack, ...body } = error

    expect(JSON.stringify(body)).toBe(JSON.stringify({
      message: "Inválido.",
      action: "Ajuste os dados enviados e tente novamente.",
      statusCode: 400,
      errorId: "id",
      errorLocationCode: "HERE",
      key: "title",
      errors: [{ key: "title", label: "Título", message: "obrigatório" }],
      name: "ValidationError"
    }))
  })

  it("captures the stack where the error is created, without its constructors", () => {
    function throwsHere() { throw new errors.NotFoundError({}) }

    try {
      throwsHere()
      expect.unreachable()
    }
    catch (err: any) {
      const frames = err.stack.split("\n").slice(1)
      expect(err.stack.split("\n")[0]).toBe("NotFoundError: Não foi possível encontrar este recurso no sistema.")
      expect(frames[0]).toContain("throwsHere")
      expect(err.stack).not.toMatch(/new NotFoundError|new BaseError/)
    }
  })

  it("keeps a stack given explicitly", () => {
    expect(new errors.InternalServerError({ stack: "Error: original" }).stack).toBe("Error: original")
  })

  it.each([
    "InternalServerError", "NotFoundError", "ServiceError", "ValidationError", "UnauthorizedError",
    "ForbiddenError", "ConflictError", "TooManyRequestsError", "UnprocessableEntityError",
  ] as const)("%s keeps every field it's given", name => {
    const fields = {
      message: "m", action: "a", errorId: "id", requestId: "r", context: "c", errorLocationCode: "L",
      key: "k", type: "t", databaseErrorCode: "d", errors: [{ key: "k", label: "l", message: "m" }]
    }
    expect(new errors[name](fields)).toMatchObject(fields)
  })

  it("lets a forbidden error carry the field's key", () => {
    expect(new errors.ForbiddenError({ key: "tags.0" })).toMatchObject({ statusCode: 403, key: "tags.0" })
  })
})
