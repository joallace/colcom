// A topic's page against a mocked API
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { describe, expect, it, vi } from "vitest"

import TopicPage from "@/pages/TopicPage"
import { UserContext } from "@/context/UserContext"


vi.mock("@/hooks/useBreakpoint", () => ({ default: () => true }))

const TOPIC = {
  id: 1, title: "Should taxes fall?", body: "<p>Context.</p>", author: "alice", config: { answers: ["sim", "não"] }, children: [],
  upvotes: 0, downvotes: 0, promotions: 0, userInteractions: [], userVote: null, tags: [],
  childrenStats: { count: 0, upvotes: 0, downvotes: 0, votes: 0, critiques: 0, suggestions: 0, answers: {} }
}

function mockApi() {
  const fetch = vi.fn(async url => new URL(url).pathname === "/topics/1" ?
    { ok: true, status: 200, json: async () => TOPIC }
    :
    { ok: false, status: 404, json: async () => ({ message: "Tópico não encontrado." }) })
  vi.stubGlobal("fetch", fetch)
  return fetch
}

const renderPage = id => render(
  <UserContext.Provider value={{ user: null, updatePromoted: () => { } }}>
    <MemoryRouter initialEntries={[`/topics/${id}`]}>
      <Routes>
        <Route path="/topics/:id" element={<TopicPage />} />
      </Routes>
    </MemoryRouter>
  </UserContext.Provider>
)

describe("the topic page", () => {
  it("shows the topic with its text, named in the title", async () => {
    mockApi()
    renderPage(1)

    expect(await screen.findByText("Context.")).toBeInTheDocument()
    expect(document.title).toBe("Should taxes fall? · colcom")
  })

  it("says so for a topic that doesn't exist", async () => {
    mockApi()
    renderPage(9)

    expect(await screen.findByText(/tópico não encontrado\./)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "ver os tópicos" })).toHaveAttribute("href", "/")
    expect(document.title).toBe("tópico não encontrado · colcom")
  })
})
