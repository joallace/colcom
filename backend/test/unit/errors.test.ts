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
})
