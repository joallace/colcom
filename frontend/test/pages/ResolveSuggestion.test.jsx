// Resolving a suggestion's conflicts against a mocked API, with the real editor
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { describe, expect, it, vi } from "vitest"

import ResolveSuggestion from "@/pages/ResolveSuggestion"
import { UserContext } from "@/context/UserContext"
import ChartProvider from "@/context/ChartProvider"


const SUGGESTION = "5".repeat(40)
const HEAD = "4".repeat(40)
const NEW_HEAD = "6".repeat(40)

const doc = (...blocks) => blocks.map(block => `<p>${block}</p>\n`).join("")

const sides = (head = HEAD, headBody = doc("Intro.", "Middle.", "Taxes should fall for everyone.", "End.")) => ({
  head: { commit: head, body: headBody },
  base: { commit: "3".repeat(40), body: doc("Intro.", "Middle.", "Taxes should fall.", "End.") },
  suggestion: { commit: SUGGESTION, body: doc("Intro, suggested.", "Middle.", "Taxes should fall a little.", "End.") }
})

const POST = {
  id: 2,
  parent_id: 1,
  title: "Yes, they should",
  type: "post",
  suggestions: [{ id: 9, author: "bob", config: { commit: SUGGESTION, message: "Softens the claim", accepted: null } }]
}

const USER = { pid: "a", accessToken: "token" }

// `merges` answers each POST in turn
function mockApi({ sidesResponses = [sides()], merges = [{ status: 204 }] } = {}) {
  let sidesCall = 0, mergeCall = 0
  const fetch = vi.fn(async (url, options = {}) => {
    const path = new URL(url).pathname
    const answer = (status, body) => ({ ok: status < 300, status, json: async () => body })

    if (path === "/contents/2")
      return answer(200, POST)
    if (path === `/contents/2/${SUGGESTION}/merge` && options.method === "POST") {
      const { status, body } = merges[mergeCall++]
      return answer(status, body)
    }
    if (path === `/contents/2/${SUGGESTION}/merge`) {
      const response = sidesResponses[Math.min(sidesCall++, sidesResponses.length - 1)]
      return response.status ? answer(response.status, response.body) : answer(200, response)
    }
    return answer(404, { message: "Não encontrado" })
  })
  vi.stubGlobal("fetch", fetch)
  return fetch
}

const renderPage = (user = USER) => render(
  <UserContext.Provider value={{ user }}>
    <ChartProvider>
      <MemoryRouter initialEntries={[`/topics/1/posts/2/suggestions/${SUGGESTION}`]}>
        <Routes>
          <Route path="/topics/:tid/posts/:pid/suggestions/:hash" element={<ResolveSuggestion />} />
          <Route path="/topics/:tid/posts/:pid" element={<p>post page</p>} />
          <Route path="/login" element={<p>login page</p>} />
        </Routes>
      </MemoryRouter>
    </ChartProvider>
  </UserContext.Provider>
)

const posts = fetch => fetch.mock.calls.filter(([, options]) => options?.method === "POST")

describe("resolving a suggestion's conflicts", () => {
  it("shows each conflict with both sides, and what was merged without asking", async () => {
    mockApi()
    renderPage()

    expect(await screen.findByText("conflito 1 de 1")).toBeTruthy()
    expect(screen.getByText("Softens the claim")).toBeTruthy()
    expect(await screen.findByText(/for everyone/)).toBeTruthy()
    expect(await screen.findByText(/a little/)).toBeTruthy()
    // The intro only the suggestion changed isn't asked about
    expect(screen.queryByText("Intro, suggested.")).toBeNull()
    expect(screen.getByText("End.…")).toBeTruthy()
    expect(screen.getByRole("button", { name: "revisar o resultado" }).disabled).toBe(true)
  })

  it("merges the chosen sides, then sends the reviewed text with the post's version", async () => {
    const fetch = mockApi()
    renderPage()

    fireEvent.click(await screen.findByLabelText("manter as duas, a sua primeiro"))
    fireEvent.click(screen.getByRole("button", { name: "revisar o resultado" }))

    expect(await screen.findByText("comparando com a versão atual do post:")).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "incorporar" }))

    expect(await screen.findByText("post page")).toBeTruthy()
    const [[, options]] = posts(fetch)
    expect(JSON.parse(options.body)).toEqual({
      body: doc("Intro, suggested.", "Middle.", "Taxes should fall for everyone.", "Taxes should fall a little.", "End."),
      head: HEAD
    })
  })

  it("starts over from the post's current version when it changed meanwhile", async () => {
    const moved = { status: 409, body: { message: "O post foi alterado enquanto os conflitos eram resolvidos.", errorLocationCode: "GIT:MERGE:HEAD_MOVED" } }
    const fetch = mockApi({ sidesResponses: [sides(), sides(NEW_HEAD, doc("Intro.", "Middle.", "Taxes should fall, now.", "End."))], merges: [moved, { status: 204 }] })
    renderPage()

    fireEvent.click(await screen.findByLabelText("usar a sugestão"))
    fireEvent.click(screen.getByRole("button", { name: "revisar o resultado" }))
    fireEvent.click(await screen.findByRole("button", { name: "incorporar" }))

    expect(await screen.findByText(moved.body.message)).toBeTruthy()
    fireEvent.click(screen.getByRole("button", { name: "recomeçar com a versão atual" }))

    // The diff highlight breaks the text up
    await waitFor(() => expect(screen.getByRole("region", { name: "sua versão" }).textContent).toContain("now"))
    fireEvent.click(screen.getByLabelText("manter a sua versão"))
    fireEvent.click(screen.getByRole("button", { name: "revisar o resultado" }))
    fireEvent.click(await screen.findByRole("button", { name: "incorporar" }))

    expect(await screen.findByText("post page")).toBeTruthy()
    expect(JSON.parse(posts(fetch)[1][1].body).head).toBe(NEW_HEAD)
  })

  it("explains why it can't be resolved", async () => {
    mockApi({ sidesResponses: [{ status: 403, body: { message: "Somente o autor do post pode aceitar ou rejeitar sugestões." } }] })
    renderPage()

    expect(await screen.findByText("Somente o autor do post pode aceitar ou rejeitar sugestões.")).toBeTruthy()
    expect(screen.getByRole("link", { name: "voltar ao post" })).toBeTruthy()
  })

  it("sends a visitor to the login", async () => {
    mockApi()
    renderPage(null)

    await waitFor(() => expect(screen.getByText("login page")).toBeTruthy())
  })
})
