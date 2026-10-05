import { describe, expect, it } from "vitest"

import { limitOffset, orderByColumn } from "@/pagination"
import { ValidationError } from "@/errors"


describe("orderByColumn", () => {
  const columns = { id: "contents.id", upvotes: "upvotes" }

  it("translates a known key into its SQL expression", () => {
    expect(orderByColumn("id", columns)).toBe("contents.id")
    expect(orderByColumn("upvotes", columns)).toBe("upvotes")
  })

  it.each(["title", "id; DROP TABLE users", "", "toString", "__proto__", "constructor"])("refuses %j", key => {
    expect(() => orderByColumn(key, columns)).toThrow(ValidationError)
  })

  it("names the valid keys in the error", () => {
    try {
      orderByColumn("nope", columns)
      expect.unreachable()
    }
    catch (err: any) {
      expect(err).toMatchObject({ statusCode: 400, key: "orderBy", action: "Utilize um dos valores: id, upvotes." })
    }
  })
})

describe("limitOffset", () => {
  it.each([
    [1, 10, "LIMIT 10 OFFSET 0"],
    [3, 20, "LIMIT 20 OFFSET 40"],
    // Defaults for missing or invalid values
    [NaN, NaN, "LIMIT 10 OFFSET 0"],
    [0, 0, "LIMIT 10 OFFSET 0"],
    // Clamped to sane bounds
    [-4, -1, "LIMIT 1 OFFSET 0"],
    [2, 1e9, "LIMIT 100 OFFSET 100"],
    [1e12, 1, "LIMIT 1 OFFSET 999999"],
    // Fractions are truncated
    [2.9, 5.7, "LIMIT 5 OFFSET 5"],
  ])("page %s of size %s is %s", (page, pageSize, expected) => {
    expect(limitOffset(page, pageSize)).toBe(expected)
  })

  it("only ever produces integers, whatever it's given", () => {
    for (const value of [Infinity, -Infinity, 1e308, Number.MAX_SAFE_INTEGER, 0.5])
      expect(limitOffset(value, value)).toMatch(/^LIMIT \d+ OFFSET \d+$/)
  })
})
