import { describe, expect, it, vi } from "vitest"

// @ts-expect-error The load test is plain JavaScript, outside the build
import { median, percentile, Recorder, summarize } from "../../scripts/loadtest/stats.mjs"
// @ts-expect-error
import { summarize as summarizeLikeBackend } from "../../scripts/loadtest/integrity.mjs"
import { summarize as backendSummarize } from "@/models/content"

vi.mock("@/pgDatabase", () => ({ default: {} }))


describe("percentile", () => {
  const sorted = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]

  it("returns a measured sample, by nearest rank", () => {
    expect(percentile(sorted, 50)).toBe(5)
    expect(percentile(sorted, 90)).toBe(9)
    expect(percentile(sorted, 99)).toBe(10)
    expect(percentile(sorted, 100)).toBe(10)
    expect(percentile(sorted, 0)).toBe(1)
  })

  it("is null without samples", () => {
    expect(percentile([], 50)).toBeNull()
  })
})

describe("median", () => {
  it("averages the middle pair of an even count and skips missing values", () => {
    expect(median([3, 1, 2])).toBe(2)
    expect(median([4, 1, 3, 2])).toBe(2.5)
    expect(median([null, 5, undefined])).toBe(5)
    expect(median([null])).toBeNull()
  })
})

describe("summarize", () => {
  it("sorts numerically and computes throughput over the window", () => {
    // A lexicographic sort would put 100 before 20
    const summary = summarize([100, 20, 3, 40], 2)
    expect(summary).toMatchObject({ count: 4, rps: 2, p50: 20, max: 100, mean: 40.8 })
  })
})

describe("Recorder", () => {
  it("counts only requests started inside the window, and errors by status and message", () => {
    const recorder = new Recorder()
    recorder.record("GET /x", 5, 1, 200)
    recorder.open(10, 20)
    recorder.record("GET /x", 9.9, 1, 200)
    recorder.record("GET /x", 10, 2, 200)
    recorder.record("GET /x", 15, 4, 409, "O texto foi alterado")
    recorder.record("GET /x", 16, 6, "timeout")
    recorder.record("GET /x", 20, 1, 200)

    const { total, endpoints, errors } = recorder.report(1)
    expect(total).toMatchObject({ count: 3, errors: 2, errorRate: 0.6667 })
    expect(endpoints["GET /x"].errorKinds).toEqual({ "409 O texto foi alterado": 1, timeout: 1 })
    expect(errors).toEqual({ "GET /x: 409 O texto foi alterado": 1, "GET /x: timeout": 1 })
  })
})

// The integrity check compares Postgres' summary with git's text using its own copy of summarize
describe("integrity's summarize", () => {
  it.each([
    "<p>First</p><p>Second</p>",
    "<p></p>\n<p>  After an empty one  </p>",
    `<p class="x">${"long ".repeat(100)}</p>`,
    "<h1>Title</h1><ul><li>No paragraphs</li></ul>",
    "<p>Versão e1: A participação</p>\n<p>direta</p>\n"
  ])("agrees with the backend's for %j", html => {
    expect(summarizeLikeBackend(html)).toBe(backendSummarize(html))
  })
})
