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

function mockApi(versions = VERSIONS, post = POST) {
  const fetch = vi.fn(async url => {
    const path = new URL(url).pathname
    const version = path.match(/^\/contents\/2\/([0-9a-f]{40})$/)?.[1]
    const body = path === "/contents/2" ? post : versions[version]
    return { ok: Boolean(body), status: body ? 200 : 404, json: async () => body ?? { message: "Não encontrado" } }
  })
  vi.stubGlobal("fetch", fetch)
  return fetch
}

const renderPage = (url = "/topics/1/posts/2", user = null) => render(
  <UserContext.Provider value={{ user }}>
    <ChartProvider>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/topics/:tid/posts/:pid" element={<PostPage />} />
          <Route path="/topics/:tid/posts/:pid/suggestions/:hash" element={<p>resolving conflicts</p>} />
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
      if (options?.method !== "POST")
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

    await waitFor(() => expect(fetch).toHaveBeenCalledWith("http://api.test/contents", expect.objectContaining({ method: "POST" })))
    const sent = JSON.parse(fetch.mock.calls.find(([, options]) => options?.method === "POST")[1].body)
    expect(sent).toMatchObject({ parent_id: 2, config: { commit: V2, from: chartPos, to: chartPos + 1, quote: { exact: CHART_TEXT } } })
    await waitFor(() => expect(container.querySelector(".ProseMirror .chart")).toHaveAttribute("data-highlight", "definitive"))
    expect(container.querySelector(".ProseMirror .chart")).toHaveAttribute("data-commit-index", "0")
  })
})

describe("the post's interactions", () => {
  it("add up its relevance marks, critiques and suggestions, and open how many of each", async () => {
    mockApi(VERSIONS, { ...POST, upvotes: 2, downvotes: 1, interactionCounts: { votes: 3, topicVotes: 5, critiques: 4, suggestions: 0 } })
    renderPage()

    // The poll votes are the post's share of the poll instead
    fireEvent.click(await screen.findByRole("button", { name: "7 interações" }))

    const breakdown = screen.getByRole("dialog", { name: "interações com o post" })
    const rows = [...breakdown.querySelectorAll("dl > div")].map(row => [row.querySelector("dt").textContent, row.querySelector("dd").textContent])
    expect(rows).toEqual([
      ["marcações de relevante", "2"],
      ["marcações de não relevante", "1"],
      ["críticas", "4"],
      ["sugestões", "0"]
    ])
  })
})

describe("the post's share of the poll", () => {
  const share = () => document.querySelector(".frame .pollShare")

  it("is its votes over the topic's, with the exact numbers on hover", async () => {
    mockApi(VERSIONS, { ...POST, interactionCounts: { votes: 12, topicVotes: 40, critiques: 0, suggestions: 0 } })
    renderPage()

    await waitFor(() => expect(share()).toHaveTextContent("30% dos 40 votos da enquete"))
    expect(share()).toHaveAttribute("title", "12 de 40 votos")
  })

  it("speaks of one vote in the singular and of none when the poll is empty", async () => {
    mockApi(VERSIONS, { ...POST, interactionCounts: { votes: 1, topicVotes: 1, critiques: 0, suggestions: 0 } })
    const { unmount } = renderPage()
    await waitFor(() => expect(share()).toHaveTextContent("100% do 1 voto da enquete"))
    unmount()

    mockApi(VERSIONS, { ...POST, interactionCounts: { votes: 0, topicVotes: 0, critiques: 0, suggestions: 0 } })
    renderPage()
    expect(await screen.findByText("votos na enquete", { exact: false })).toHaveTextContent("0 votos na enquete")
  })

  // The viewer, bob, votes here and withdraws it; `before` is the post they had voted for in the topic
  async function voteAndWithdraw(before, counts) {
    localStorage.setItem("accessToken", "token")
    const userInteractions = before === POST.id ? ["vote"] : []
    const fetch = mockApi(VERSIONS, { ...POST, userInteractions, userTopicVote: before, interactionCounts: { ...counts, critiques: 0, suggestions: 0 } })
    renderPage("/topics/1/posts/2", { accessToken: "token", pid: "b", name: "bob" })

    await waitFor(() => expect(share()).toBeTruthy())
    const seen = [share().getAttribute("title")]
    const radio = () => document.querySelector(".frame .votingButtons input[type='radio']")
    for (let i = 0; i < 2; i++) {
      fireEvent.click(radio())
      await waitFor(() => expect(share().getAttribute("title")).not.toBe(seen.at(-1)))
      seen.push(share().getAttribute("title"))
      // The button takes no click until the vote is sent
      await waitFor(() => expect(fetch.mock.calls.filter(([, options]) => options?.method === "POST")).toHaveLength(i + 1))
      await act(async () => {})
    }
    localStorage.removeItem("accessToken")
    return seen
  }

  it("counts a new vote in the post and in the poll", async () => {
    expect(await voteAndWithdraw(null, { votes: 1, topicVotes: 4 })).toEqual(["1 de 4 votos", "2 de 5 votos", "1 de 4 votos"])
  })

  it("moves a vote from another post without changing the poll's total, and withdraws it from both", async () => {
    expect(await voteAndWithdraw(7, { votes: 1, topicVotes: 4 })).toEqual(["1 de 4 votos", "2 de 4 votos", "1 de 3 votos"])
  })

  it("withdraws the viewer's vote here from both, and casts it back", async () => {
    expect(await voteAndWithdraw(POST.id, { votes: 2, topicVotes: 4 })).toEqual(["2 de 4 votos", "1 de 3 votos", "2 de 4 votos"])
  })
})

describe("accepting a suggestion", () => {
  const SUGGESTION = "5".repeat(40)
  const SUGGESTED_HTML = p("Taxes should fall a little.", "Public spending must be reviewed.")
  const suggestions = [{ id: 9, author: "bob", author_avatar: "", created_at: new Date().toISOString(), config: { commit: SUGGESTION, message: "Softens the claim", accepted: null } }]

  // The author opens the pending suggestion and accepts it; the API answers the merge with `merge`
  async function accept(merge) {
    const fetch = mockApi({ ...VERSIONS, [SUGGESTION]: { body: SUGGESTED_HTML, critiques: [], versions: {}, lineages: {}, base: { commit: V2, body: V2_HTML } } }, { ...POST, suggestions })
    const original = fetch.getMockImplementation()
    fetch.mockImplementation(async (url, options) => options?.method === "POST" ?
      { ok: merge.status < 300, status: merge.status, json: async () => merge.body } : original(url, options))
    renderPage("/topics/1/posts/2", { pid: "a", accessToken: "token" })

    await menu("incorporar sugestões")
    fireEvent.click(await screen.findByText("Softens the claim"))
    await menu("aceitar sugestão")
    return fetch
  }

  // jsdom gets no breakpoints from the styles, so the post's buttons are in its dropdown menu
  async function menu(option) {
    await waitFor(() => expect(document.querySelector(".frame .dropdownMenu > .clickable")).toBeTruthy())
    fireEvent.click(document.querySelector(".frame .dropdownMenu > .clickable"))
    fireEvent.click(await screen.findByText(option))
  }

  it("hides the critiques while it's reviewed and shows them again once it's closed", async () => {
    // The suggestion descends from v2, so a critique of v2 is followed onto it too
    const onSuggestion = { body: SUGGESTED_HTML, critiques: [critique(12, V2_HTML, V2, "spending must be reviewed")], versions: { [V2]: V2_HTML }, lineages: { [V2]: [V2, SUGGESTION] }, base: { commit: V2, body: V2_HTML } }
    mockApi({ ...VERSIONS, [SUGGESTION]: onSuggestion }, { ...POST, suggestions })
    const { container } = renderPage("/topics/1/posts/2", { pid: "a", accessToken: "token" })
    await waitFor(() => expect(marks(container).length).toBe(3))

    await menu("incorporar sugestões")
    fireEvent.click(await screen.findByText("Softens the claim"))
    await waitFor(() => expect(container.querySelector(".ProseMirror")).toHaveTextContent("a little."))
    // Its changes are drawn against the version it was made on, with no highlight over them
    await waitFor(() => expect(container.querySelector(".diffLegend")).toBeTruthy())
    expect(marks(container)).toEqual([])
    expect(container.querySelector(".critiqueLegend")).toBeNull()

    await menu("fechar sugestão")
    await waitFor(() => expect(container.querySelector(".ProseMirror")).toHaveTextContent("Taxes should fall for everyone."))
    await waitFor(() => expect(marks(container).length).toBe(3))
    expect(container.querySelector(".critiqueLegend")).toBeTruthy()
  })

  it("leads to resolving its conflicts when it changes passages the author also changed", async () => {
    const fetch = await accept({ status: 409, body: { message: "A sugestão altera trechos…", errorLocationCode: "GIT:MERGE:CONFLICT" } })

    expect(await screen.findByText("resolving conflicts")).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(`http://api.test/contents/2/${SUGGESTION}/merge`, expect.objectContaining({ method: "POST" }))
  })

  it("says why it couldn't be merged otherwise", async () => {
    await accept({ status: 409, body: { message: "O texto foi alterado por outra pessoa ao mesmo tempo." } })

    expect(await screen.findByText("O texto foi alterado por outra pessoa ao mesmo tempo.")).toBeInTheDocument()
  })
})
