import { describe, expect, it } from "vitest"
import Ajv from "ajv"
import { createValidators } from "@colcom/shared"

import { META_GROUPS } from "@/metaTopics"


const { validate } = createValidators(Ajv)
const topics = META_GROUPS.flatMap(group => group.topics)

describe("the meta topics' definitions", () => {
  it("pass the schema every topic passes", () => {
    for (const { title, body, answers } of topics) {
      const result = validate("topic", { title, body, config: { answers } })
      expect(result.valid, `${title}: ${JSON.stringify(result.errors)}`).toBe(true)
    }
  })

  it("have unique titles and group keys, as topics are found again by their title", () => {
    expect(new Set(topics.map(topic => topic.title)).size).toBe(topics.length)
    expect(new Set(META_GROUPS.map(group => group.key)).size).toBe(META_GROUPS.length)
  })

})
