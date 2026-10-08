// The write page against a mocked API: its topic comes from ?topic=, and drafts are kept per topic
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { describe, expect, it, vi } from "vitest"

import Write from "@/pages/Write"
import { UserContext } from "@/context/UserContext"
import ChartProvider from "@/context/ChartProvider"
import { saveDraft } from "@/assets/drafts"


const API = "http://api.test"

const TOPICS = {
  1: { id: 1, type: "topic", title: "Should taxes fall?", config: { answers: ["sim", "não"] } },
  2: { id: 2, type: "topic", title: "Open question", config: { answers: [] } },
  3: { id: 3, type: "post", title: "A post, not a topic", config: { answer: "sim" } }
}

function mockApi() {
  const fetch = vi.fn(async (url, options) => {
    const { pathname } = new URL(url)
    if (options?.method === "post" && pathname === "/contents")
      return { ok: true, status: 201, json: async () => ({ id: 42 }) }
    const topic = TOPICS[pathname.match(/^\/contents\/(\d+)$/)?.[1]]
    if (topic)
      return { ok: true, status: 200, json: async () => topic }
    return { ok: false, status: 404, json: async () => ({ message: "Conteúdo não encontrado." }) }
  })
  vi.stubGlobal("fetch", fetch)
  return fetch
}

function PostPage() {
  const { pathname } = useLocation()
  return <p>post page {pathname}</p>
}

const renderPage = (entry, user = { pid: "a1", name: "alice", accessToken: "token-123" }) => render(
  <UserContext.Provider value={{ user }}>
    <ChartProvider>
      <MemoryRouter initialEntries={[entry]}>
        <Routes>
          <Route path="/write" element={<Write />} />
          <Route path="/topics/:topicId/posts/:postId" element={<PostPage />} />
        </Routes>
      </MemoryRouter>
    </ChartProvider>
  </UserContext.Provider>
)

describe("Write", () => {
  it("loads the topic from ?topic= when opened directly", async () => {
    const fetch = mockApi()
    renderPage("/write?topic=1")

    expect(await screen.findByRole("link", { name: "Should taxes fall?" })).toHaveAttribute("href", "/topics/1")
    expect(screen.getByLabelText("sim")).toBeInTheDocument()
    expect(screen.getByLabelText("não")).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(`${API}/contents/1?omit_body`)
  })

  it("uses the topic in the router state without fetching it", async () => {
    const fetch = mockApi()
    renderPage({ pathname: "/write", search: "?topic=2", state: TOPICS[2] })

    expect(await screen.findByRole("link", { name: "Open question" })).toBeInTheDocument()
    // An open topic asks for no answer
    expect(screen.queryByText("sua resposta")).not.toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("ignores router state about another topic", async () => {
    const fetch = mockApi()
    renderPage({ pathname: "/write", search: "?topic=1", state: TOPICS[2] })

    expect(await screen.findByRole("link", { name: "Should taxes fall?" })).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(`${API}/contents/1?omit_body`)
  })

  it("says so when no topic is given, without asking the API", async () => {
    const fetch = mockApi()
    renderPage("/write")

    expect(screen.getByText(/nenhum tópico escolhido para responder/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "ver os tópicos" })).toHaveAttribute("href", "/")
    renderPage("/write?topic=abc")
    expect(screen.getAllByText(/nenhum tópico escolhido para responder/)).toHaveLength(2)
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each([
    ["doesn't exist", "99"],
    ["is not a topic", "3"]
  ])("says the topic wasn't found when it %s", async (_, id) => {
    mockApi()
    renderPage(`/write?topic=${id}`)

    expect(await screen.findByText(/tópico não encontrado/)).toBeInTheDocument()
  })

  it("says the topic wasn't found when the API can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch") }))
    vi.spyOn(console, "error").mockImplementation(() => { })
    renderPage("/write?topic=1")

    expect(await screen.findByText(/tópico não encontrado/)).toBeInTheDocument()
  })

  it("shows each topic's own draft", async () => {
    mockApi()
    saveDraft(1, "title", "Draft for taxes")
    saveDraft(1, "body", "<p>Taxes draft body</p>")

    const { unmount } = renderPage("/write?topic=1")
    expect(await screen.findByText("Draft for taxes")).toBeInTheDocument()
    expect(await screen.findByText("Taxes draft body")).toBeInTheDocument()
    unmount()

    renderPage("/write?topic=2")
    await screen.findByRole("link", { name: "Open question" })
    expect(screen.queryByText("Draft for taxes")).not.toBeInTheDocument()
    expect(screen.queryByText("Taxes draft body")).not.toBeInTheDocument()
  })

  it("keeps the title as the topic's draft when it loses focus", async () => {
    mockApi()
    renderPage("/write?topic=2")
    await screen.findByRole("link", { name: "Open question" })

    const title = document.querySelector("h1.title")
    title.textContent = "My answer"
    fireEvent.blur(title)

    expect(localStorage.getItem("draft:2:title")).toBe("My answer")
    expect(localStorage.getItem("draft:1:title")).toBeNull()
  })

  it("publishes the post in the topic and clears only its draft", async () => {
    const fetch = mockApi()
    saveDraft(1, "title", "Yes, they should")
    saveDraft(1, "body", "<p>Because.</p>")
    saveDraft(2, "title", "Another draft")
    renderPage("/write?topic=1")

    fireEvent.click(await screen.findByLabelText("sim"))
    fireEvent.click(screen.getByRole("button", { name: "publicar" }))

    expect(await screen.findByText("post page /topics/1/posts/42")).toBeInTheDocument()
    const [, options] = fetch.mock.calls.find(([, options]) => options?.method === "post")
    expect(JSON.parse(options.body)).toEqual({ title: "Yes, they should", body: "<p>Because.</p>", config: { answer: "sim" }, parent_id: 1 })
    await waitFor(() => expect(localStorage.getItem("draft:1:title")).toBeNull())
    expect(localStorage.getItem("draft:1:body")).toBeNull()
    expect(localStorage.getItem("draft:2:title")).toBe("Another draft")
  })
})
