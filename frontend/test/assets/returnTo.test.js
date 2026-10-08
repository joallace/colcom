import { describe, expect, it } from "vitest"

import { loginPath, loginState, returnPath } from "@/assets/returnTo"

describe("loginPath", () => {
  it("remembers the whole address, query and hash included", () => {
    expect(loginPath({ pathname: "/topics/1/posts/2", search: "?commit=abc&critique=3", hash: "#x" }))
      .toBe("/login?returnTo=%2Ftopics%2F1%2Fposts%2F2%3Fcommit%3Dabc%26critique%3D3%23x")
  })

  it("has nothing to remember from home or the login page itself", () => {
    expect(loginPath({ pathname: "/", search: "", hash: "" })).toBe("/login")
    expect(loginPath({ pathname: "/login", search: "?returnTo=%2Fprofile", hash: "" })).toBe("/login")
    expect(loginPath(undefined)).toBe("/login")
  })
})

describe("loginState", () => {
  it("carries the page's router state, if it has any", () => {
    expect(loginState({ state: { id: 1 } })).toEqual({ returnState: { id: 1 } })
    expect(loginState({ state: null })).toBeUndefined()
  })
})

describe("returnPath", () => {
  it("goes back to paths on this site", () => {
    expect(returnPath("/topics/1/posts/2?commit=abc#x")).toBe("/topics/1/posts/2?commit=abc#x")
    expect(returnPath("/users/bob%20silva")).toBe("/users/bob%20silva")
  })

  it("goes home without one, or for anything that could leave the site or loop", () => {
    for (const unsafe of [null, "", "profile", "https://evil.test", "//evil.test", "/\\evil.test", "javascript:alert(1)", "/login", "/login?returnTo=%2F"])
      expect(returnPath(unsafe)).toBe("/")
  })
})
