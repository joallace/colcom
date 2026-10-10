// The meta page against a mocked API: the foundational topics in their groups
import { render, screen, within } from "@testing-library/react"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"

import Meta from "@/pages/Meta"
import { UserContext } from "@/context/UserContext"


vi.mock("@/hooks/useBreakpoint", () => ({ default: () => true }))

const topic = (id, title, answers = []) => ({
  id, title, author: "colcom", config: { answers }, children: [], upvotes: 0, downvotes: 0, promotions: 0, userInteractions: [], userVote: null,
  childrenStats: { count: 0, upvotes: 0, downvotes: 0, votes: 0, critiques: 0, suggestions: 0, answers: {} },
  tags: [{ slug: "meta", name: "Meta", provisional: false, reserved: true, visible: true, endorsements: 1, contests: 0 }]
})

function mockApi(groups) {
  const fetch = vi.fn(async url => new URL(url).pathname === "/meta" ?
    { ok: true, status: 200, json: async () => ({ groups }) }
    :
    { ok: false, status: 404, json: async () => ({}) })
  vi.stubGlobal("fetch", fetch)
  return fetch
}

const renderAs = user => render(
  <UserContext.Provider value={{ user, updatePromoted: () => { } }}>
    <MemoryRouter initialEntries={["/meta"]}>
      <Meta />
    </MemoryRouter>
  </UserContext.Provider>
)

describe("the meta page", () => {
  it("shows the foundational topics under their groups, in order", async () => {
    const fetch = mockApi([
      { key: "carta", name: "Carta do colcom", description: "Os fundamentos.", topics: [topic(1, "Por que o colcom existe?"), topic(2, "Como o colcom deveria ser?")] },
      { key: "funcionamento", name: "Funcionamento", description: "Como muda.", topics: [topic(3, "O colcom promove o consenso?", ["sim", "não", "em parte"])] }
    ])
    renderAs({ accessToken: "token" })

    const carta = await screen.findByRole("region", { name: "Carta do colcom" })
    expect(within(carta).getAllByRole("heading", { level: 2 }).map(heading => heading.textContent)).toEqual(["Carta do colcom"])
    expect(carta).toHaveTextContent(/Por que o colcom existe\?.*Como o colcom deveria ser\?/)
    expect(within(screen.getByRole("region", { name: "Funcionamento" })).getByText("O colcom promove o consenso?")).toBeInTheDocument()
    // The header's link, and each topic's pill
    expect(screen.getAllByRole("link", { name: "Meta" }).map(link => link.getAttribute("href"))).toEqual(Array(4).fill("/t/meta"))
    expect(fetch).toHaveBeenCalledWith("http://api.test/meta", { headers: { Authorization: "Bearer token" } })
    expect(document.title).toBe("meta · colcom")
  })

  it("leaves out empty groups, and says so when there's nothing yet", async () => {
    mockApi([{ key: "carta", name: "Carta do colcom", description: "", topics: [] }])
    renderAs(null)

    expect(await screen.findByRole("heading", { name: "meta" })).toBeInTheDocument()
    expect(await screen.findByText("os tópicos meta ainda não foram abertos.")).toBeInTheDocument()
    expect(screen.queryByRole("region", { name: "Carta do colcom" })).toBeNull()
  })
})
