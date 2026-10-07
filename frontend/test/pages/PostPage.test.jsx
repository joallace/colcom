// The post page against a mocked API: the real editor, anchoring and highlights together
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { MemoryRouter, Route, Routes } from "react-router"
import { describe, expect, it, vi } from "vitest"

import PostPage from "@/pages/PostPage"
import { UserContext } from "@/context/UserContext"
import ChartProvider from "@/context/ChartProvider"
import { CHART_TEXT } from "@/assets/textIndex"
import { chart, critiqueOn, p } from "../support/critiques"


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

function mockApi(versions = VERSIONS) {
  const fetch = vi.fn(async url => {
    const path = new URL(url).pathname
    const version = path.match(/^\/contents\/2\/([0-9a-f]{40})$/)?.[1]
    const body = path === "/contents/2" ? POST : versions[version]
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

    // Critique 10 (made on v1) and 12 (on v2) overlap on "fall": one group, shaded where both apply.
    // Each piece opens the group starting with the critiques covering it.
    await waitFor(() => expect(marks(container).length).toBeGreaterThan(0))
    const highlighted = marks(container).map(mark => [mark.textContent, mark.dataset.commitIndex, mark.dataset.level])
    expect(highlighted).toEqual([
      ["Taxes should ", "[2,0]", "1"],
      ["fall", "[2,0]", "2"],
      [" for everyone", "[0,2]", "1"],
    ])
  })

  // The open critiques' titles, in the order they're shown, and the passage marked in the post
  const openTitles = () => [...document.querySelectorAll(".frame.critique .title")].map(title => title.textContent)
  const markedPassage = container => [...container.querySelectorAll(".ProseMirror mark.temporary")].map(mark => mark.textContent).join("")

  it.each([
    ["Taxes should ", ["Critique 12", "Critique 10"], "Taxes should fall"],
    [" for everyone", ["Critique 10", "Critique 12"], "fall for everyone"],
  ])("opens a group from %j with a critique of the clicked words first, its passage marked", async (clicked, titles, passage) => {
    mockApi()
    const { container } = renderPage()

    await waitFor(() => expect(marks(container).length).toBe(3))
    fireEvent.click(marks(container).find(mark => mark.textContent === clicked))

    await waitFor(() => expect(openTitles()).toEqual(titles))
    await waitFor(() => expect(markedPassage(container)).toBe(passage))
  })

  it("opens a group from words all its critiques cover with the most relevant first", async () => {
    const [ten, eleven, twelve] = VERSIONS[V2].critiques
    mockApi({ ...VERSIONS, [V2]: { ...VERSIONS[V2], critiques: [{ ...ten, upvotes: 5 }, eleven, twelve] } })
    const { container } = renderPage()

    await waitFor(() => expect(marks(container).length).toBe(3))
    expect(marks(container).map(mark => mark.dataset.commitIndex)).toEqual(["[2,0]", "[0,2]", "[0,2]"])
    fireEvent.click(marks(container).find(mark => mark.textContent === "fall"))

    await waitFor(() => expect(openTitles()).toEqual(["Critique 10", "Critique 12"]))
    await waitFor(() => expect(markedPassage(container)).toBe("fall for everyone"))
  })

  it("opens a linked critique first among those overlapping it", async () => {
    mockApi()
    // jsdom doesn't scroll
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    renderPage("/topics/1/posts/2?critique=10")

    await waitFor(() => expect(openTitles()).toEqual(["Critique 10", "Critique 12"]))
    // Anchored where the group opens in that order: words only the linked critique covers
    expect(scrollIntoView.mock.contexts[0]).toHaveTextContent("for everyone")
    delete Element.prototype.scrollIntoView
  })

  it("opens a linked critique first even where no words open it first", async () => {
    // Critique 13 criticises only "fall", inside the more relevant critique 10's passage
    const [ten] = VERSIONS[V2].critiques
    mockApi({ ...VERSIONS, [V2]: { ...VERSIONS[V2], critiques: [{ ...ten, upvotes: 5 }, critique(13, V2_HTML, V2, "fall")] } })
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    const { container } = renderPage("/topics/1/posts/2?critique=13")

    await waitFor(() => expect(openTitles()).toEqual(["Critique 13", "Critique 10"]))
    expect(marks(container).map(mark => mark.dataset.commitIndex)).toEqual(["[0,1]", "[0,1]"])
    expect(scrollIntoView.mock.contexts[0]).toHaveTextContent("fall")
    await waitFor(() => expect(markedPassage(container)).toBe("fall"))
    delete Element.prototype.scrollIntoView
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

  it("opens the criticised version from a critique made on it", async () => {
    // Critique 10 alone, so its highlight opens it rather than a group
    mockApi({ ...VERSIONS, [V2]: { ...VERSIONS[V2], critiques: VERSIONS[V2].critiques.slice(0, 1) } })
    const { container } = renderPage()

    await waitFor(() => expect(marks(container).length).toBeGreaterThan(0))
    fireEvent.click(marks(container)[0])
    fireEvent.click(await screen.findByText("ver a versão criticada"))

    // The passage marked while the critique was open belonged to the other version: nothing is left marked
    await waitFor(() => expect(container.querySelector(".ProseMirror")).toHaveTextContent("This sentence will be cut from the text."))
    await waitFor(() => expect(marks(container).map(mark => mark.textContent)).toEqual(["fall for everyone", "will be cut from the text"]))
    expect(container.querySelector(".ProseMirror mark.temporary")).toBeNull()
  })

  it("falls back to the latest version for an unknown commit in the URL", async () => {
    const fetch = mockApi()
    renderPage(`/topics/1/posts/2?commit=${"f".repeat(40)}`)

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(`http://api.test/contents/2/${V2}`, expect.anything()))
  })

  it("outlines a criticised chart and opens its critique when the chart is clicked", async () => {
    const html = p("Taxes should fall for everyone.") + chart() + p("Public spending must be reviewed.")
    mockApi({ [V2]: { body: html, critiques: [critique(20, html, V2, CHART_TEXT)], versions: {}, lineages: {} } })
    const { container } = renderPage()

    await waitFor(() => expect(container.querySelector('.ProseMirror .chart[data-commit-index="0"]')).not.toBeNull())
    const criticised = container.querySelector(".ProseMirror .chart")
    expect(criticised).toHaveAttribute("data-highlight", "definitive")
    expect(criticised).toHaveAttribute("data-level", "1")
    expect(marks(container)).toEqual([])

    fireEvent.click(criticised)
    expect(await screen.findByText("Critique 20")).toBeInTheDocument()
  })

  it("publishes a critique of a chart and highlights the chart", async () => {
    const html = p("Taxes should fall for everyone.") + chart() + p("Public spending must be reviewed.")
    const fetch = mockApi({ [V2]: { body: html, critiques: [], versions: {}, lineages: {} } })
    const get = fetch.getMockImplementation()
    fetch.mockImplementation(async (url, options) => {
      if (options?.method !== "post")
        return get(url, options)
      const sent = JSON.parse(options.body)
      const created = { ...sent, id: 30, author: "bob", upvotes: 0, downvotes: 0, created_at: new Date().toISOString() }
      return { ok: true, status: 201, json: async () => created }
    })
    const { container } = render(
      <UserContext.Provider value={{ user: { accessToken: "token", pid: "b", name: "bob" } }}>
        <ChartProvider>
          <MemoryRouter initialEntries={["/topics/1/posts/2"]}>
            <Routes>
              <Route path="/topics/:tid/posts/:pid" element={<PostPage />} />
            </Routes>
          </MemoryRouter>
        </ChartProvider>
      </UserContext.Provider>
    )

    await waitFor(() => expect(container.querySelector(".ProseMirror .chart")).not.toBeNull())
    const post = container.querySelector(".ProseMirror").editor
    let chartPos
    post.state.doc.forEach((node, pos) => { if (node.type.name === "chart") chartPos = pos })
    act(() => { post.commands.setNodeSelection(chartPos) })

    fireEvent.click(await screen.findByRole("button", { name: "criticar" }))
    const publish = await screen.findByRole("button", { name: "publicar" })
    expect(container.querySelector(".ProseMirror .chart")).toHaveAttribute("data-highlight", "temporary")

    // The critique's title and body, as the reader writes them
    const modal = publish.closest(".modal") ?? document.body
    const [title] = modal.querySelectorAll(".frame [contenteditable='true']")
    title.textContent = "Missing inflation"
    const body = [...modal.querySelectorAll(".ProseMirror")].at(-1)
    act(() => { body.editor.commands.setContent("<p>The values are nominal.</p>") })
    fireEvent.blur(body)
    fireEvent.click(publish)

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("http://api.test/contents", expect.objectContaining({ method: "post" })))
    const sent = JSON.parse(fetch.mock.calls.find(([, options]) => options?.method === "post")[1].body)
    expect(sent).toMatchObject({ parent_id: 2, config: { commit: V2, from: chartPos, to: chartPos + 1, quote: { exact: CHART_TEXT } } })
    await waitFor(() => expect(container.querySelector(".ProseMirror .chart")).toHaveAttribute("data-highlight", "definitive"))
    expect(container.querySelector(".ProseMirror .chart")).toHaveAttribute("data-commit-index", "0")
  })
})
