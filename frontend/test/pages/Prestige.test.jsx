// The page explaining prestige against a mocked API: the instance's own rules and limits
import { render, screen, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { describe, expect, it, vi } from "vitest"

import Prestige from "@/pages/Prestige"


const RULES = [
  { reason: "critique_fixed", amount: 10 },
  { reason: "fix_accepted", amount: 5 },
  { reason: "rebuttal_accepted", amount: 0 },
  { reason: "suggestion_merged", amount: 5 },
  { reason: "suggestion_adopted", amount: 1 },
  { reason: "jury_duty", amount: 2 }
]
const LIMITS = { user: { cap: 200, window: 86_400 }, pair: { cap: 5, window: 30 * 86_400 } }

function mockApi(body = { rules: RULES, limits: LIMITS }) {
  const fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => body }))
  vi.stubGlobal("fetch", fetch)
  return fetch
}

const renderPage = () => render(
  <MemoryRouter initialEntries={["/prestige"]}>
    <Routes>
      <Route path="/prestige" element={<Prestige />} />
    </Routes>
  </MemoryRouter>
)

describe("the prestige page", () => {
  it("lists what each rule is worth on this instance, leaving out the ones switched off", async () => {
    const fetch = mockApi()
    renderPage()

    const rules = within(await screen.findByRole("region", { name: "como se ganha" })).getAllByRole("listitem")
    expect(rules.map(rule => rule.querySelector(".prestigeAmount").textContent)).toEqual(["+10", "+5", "+5", "+1", "+2"])
    expect(rules[0]).toHaveTextContent("Uma crítica sua levou a uma correção")
    expect(rules[1]).toHaveTextContent("Quem criticou seu post aceitou a correção que você fez.")
    // One the page has no words for still shows
    expect(rules[4]).toHaveTextContent("jury_duty")
    expect(screen.queryByText(/aceitou a sua refutação/)).toBeNull()

    expect(fetch).toHaveBeenCalledWith("http://api.test/prestige", expect.anything())
    expect(document.title).toBe("prestígio · colcom")
  })

  it("says the limits", async () => {
    mockApi()
    renderPage()

    const limits = await screen.findByRole("region", { name: "limites" })
    expect(within(limits).getAllByRole("listitem").map(item => item.textContent)).toEqual([
      "Ninguém ganha mais de 200 de prestígio por dia.",
      "Ninguém recebe mais de 5 prêmios da mesma pessoa a cada 30 dias."
    ])
  })

  it("says when the instance lifted them", async () => {
    mockApi({ rules: RULES, limits: { user: null, pair: null } })
    renderPage()

    expect(await screen.findByText("Esta instância não limita quanto prestígio se ganha.")).toBeInTheDocument()
  })

  it("says so when the API can't be reached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => { })
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch") }))
    renderPage()

    expect(await screen.findByText("não foi possível se conectar ao colcom.")).toBeInTheDocument()
  })
})
