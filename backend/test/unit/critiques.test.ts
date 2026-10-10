// The critique lifecycle's rules (shared/src/critiques.js) and the request that acts on them
import { describe, expect, it } from "vitest"
import Ajv from "ajv"
import { CRITIQUE_ACTIONS, CRITIQUE_STATES, createValidators, critiqueActions, isClosedCritique } from "@colcom/shared"


const { validate: check } = createValidators(Ajv)

describe("critiqueActions", () => {
  it("lets the post's author answer an open or upheld critique", () => {
    expect(critiqueActions("open", { isAuthor: true })).toEqual(["address", "rebut"])
    expect(critiqueActions("upheld", { isAuthor: true })).toEqual(["address", "rebut"])
    expect(critiqueActions("addressed", { isAuthor: true })).toEqual([])
  })

  it("lets the critic answer the author, and withdraw until the critique is closed", () => {
    expect(critiqueActions("open", { isCritic: true })).toEqual(["withdraw"])
    expect(critiqueActions("rebutted", { isCritic: true })).toEqual(["accept", "dispute", "withdraw"])
    expect(critiqueActions("in_review", { isCritic: true })).toEqual(["withdraw"])
  })

  it("gives someone who criticised their own post both roles, and nobody else anything", () => {
    expect(critiqueActions("open", { isAuthor: true, isCritic: true })).toEqual(["address", "rebut", "withdraw"])
    expect(critiqueActions("open")).toEqual([])
  })

  it("leaves nothing to do on a closed critique", () => {
    for (const status of CRITIQUE_STATES.filter(isClosedCritique))
      expect(critiqueActions(status, { isAuthor: true, isCritic: true })).toEqual([])
  })

  it("only names known states", () => {
    for (const rule of Object.values(CRITIQUE_ACTIONS))
      expect(CRITIQUE_STATES).toEqual(expect.arrayContaining([...rule.from, rule.to]))
  })
})

describe("the critiqueEvent schema", () => {
  it("needs a version to address and reasons to rebut or dispute", () => {
    expect(check("critiqueEvent", { action: "address", commit: "abc1234" }).valid).toBe(true)
    expect(check("critiqueEvent", { action: "address", note: "Corrigi." }).errors[0].key).toBe("commit")
    expect(check("critiqueEvent", { action: "rebut" }).errors[0].key).toBe("note")
    expect(check("critiqueEvent", { action: "dispute", note: " " }).errors[0].key).toBe("note")
    expect(check("critiqueEvent", { action: "accept" }).valid).toBe(true)
    expect(check("critiqueEvent", { action: "withdraw", note: "Mudei de ideia." }).valid).toBe(true)
  })

  it("refuses unknown actions and hashes that aren't hashes", () => {
    expect(check("critiqueEvent", { action: "close" }).errors[0].key).toBe("action")
    expect(check("critiqueEvent", { action: "address", commit: "--output=x" }).errors[0].key).toBe("commit")
  })
})
