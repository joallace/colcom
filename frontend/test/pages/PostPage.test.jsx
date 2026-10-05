// The post page against a mocked API: the real editor, anchoring and highlights together
import { render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { describe, expect, it, vi } from "vitest"

import PostPage from "@/pages/PostPage"
import { UserContext } from "@/context/UserContext"
import ChartProvider from "@/context/ChartProvider"
import { critiqueOn, p } from "../support/critiques"


const V1 = "1".repeat(40)
const V2 = "2".repeat(40)

const V1_HTML = p("Taxes should fall for everyone.", "This sentence will be cut from the text.", "Public spending must be reviewed.")
const V2_HTML = p("Taxes should fall for everyone.", "Public spending must be reviewed.")

const critique = (id, html, commit, exact) => ({
  ...critiqueOn(html, commit, exact),
  id,
  title: `Critique ${id}`,
  author: "bob",
  body: `<p>Body of critique ${id}</p>`,
  upvotes: 0,
  downvotes: 0,
  created_at: new Date().toISOString()
})

const POST = {
  id: 2,
  parent_id: 1,
  parent_title: "Should taxes fall?",
  title: "Yes, they should",
  type: "post",
  author: "alice",
  author_id: "a",
  author_avatar: "",
  config: { answer: "sim" },
  upvotes: 0,
  downvotes: 0,
  history: [
    { commit: V1, subject: "init post 2", date: new Date().toISOString(), author: "alice" },
    { commit: V2, subject: "Cuts a sentence", date: new Date().toISOString(), author: "alice" }
  ]
}

const VERSIONS = {
  [V1]: { body: V1_HTML, critiques: [critique(10, V1_HTML, V1, "fall for everyone"), critique(11, V1_HTML, V1, "will be cut from the text")], versions: {}, lineages: {} },
  [V2]: {
    body: V2_HTML,
    critiques: [critique(10, V1_HTML, V1, "fall for everyone"), critique(11, V1_HTML, V1, "will be cut from the text"), critique(12, V2_HTML, V2, "Taxes should fall")],
    versions: { [V1]: V1_HTML },
    lineages: { [V1]: [V1, V2] }
  }
}

function mockApi() {
  const fetch = vi.fn(async url => {
    const path = new URL(url).pathname
    const version = path.match(/^\/contents\/2\/([0-9a-f]{40})$/)?.[1]
    const body = path === "/contents/2" ? POST : VERSIONS[version]
    return { ok: Boolean(body), status: body ? 200 : 404, json: async () => body ?? { message: "Não encontrado" } }
  })
  vi.stubGlobal("fetch", fetch)
  return fetch
}

const renderPage = (url = "/topics/1/posts/2") => render(
  <UserContext.Provider value={{ user: null }}>
    <ChartProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/topics/:tid/posts/:pid" element={<PostPage />} />
        </Routes>
      </MemoryRouter>
    </ChartProvider>
  </UserContext.Provider>
)

const marks = container => [...container.querySelectorAll(".ProseMirror mark")]

describe("PostPage", () => {
  it("shows the latest version with the critiques that still apply highlighted", async () => {
    const fetch = mockApi()
    const { container } = renderPage()

    await waitFor(() => expect(container.querySelector(".ProseMirror")).toHaveTextContent("Public spending must be reviewed."))
    expect(container.querySelector(".ProseMirror")).not.toHaveTextContent("This sentence will be cut")
    expect(fetch).toHaveBeenCalledWith(`http://api.test/contents/2/${V2}`, expect.anything())
    expect(screen.getByText("Should taxes fall?")).toBeInTheDocument()

    // Critique 10 (made on v1) and 12 (on v2) overlap on "fall": one group, shaded where both apply
    await waitFor(() => expect(marks(container).length).toBeGreaterThan(0))
    const highlighted = marks(container).map(mark => [mark.textContent, mark.dataset.commitIndex, mark.dataset.level])
    expect(highlighted).toEqual([
      ["Taxes should ", "[2,0]", "1"],
      ["fall", "[2,0]", "2"],
      [" for everyone", "[2,0]", "1"],
    ])
  })

  it("lists critiques whose passage was removed below the post", async () => {
    mockApi()
    renderPage()

    expect(await screen.findByText("Críticas a trechos removidos do texto")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Critique 11" })).toBeInTheDocument()
  })

  it("shows the version the URL asks for", async () => {
    const fetch = mockApi()
    const { container } = renderPage(`/topics/1/posts/2?commit=${V1}`)

    await waitFor(() => expect(container.querySelector(".ProseMirror")).toHaveTextContent("This sentence will be cut from the text."))
    expect(fetch).toHaveBeenCalledWith(`http://api.test/contents/2/${V1}`, expect.anything())
    expect(screen.queryByText("Críticas a trechos removidos do texto")).toBeNull()
    await waitFor(() => expect(marks(container).map(mark => mark.textContent)).toEqual(["fall for everyone", "will be cut from the text"]))
  })

  it("falls back to the latest version for an unknown commit in the URL", async () => {
    const fetch = mockApi()
    renderPage(`/topics/1/posts/2?commit=${"f".repeat(40)}`)

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(`http://api.test/contents/2/${V2}`, expect.anything()))
  })
})
