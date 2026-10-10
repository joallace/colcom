// The search page against a mocked API
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { describe, expect, it, vi } from "vitest"

import Search from "@/pages/Search"
import SearchBox from "@/components/layout/SearchBox"
import { UserContext } from "@/context/UserContext"


const author = { author: "alice", author_avatar: "AAAA", upvotes: 0, downvotes: 0 }

const topic = {
  ...author,
  type: "topic",
  id: 1,
  title: "Semana de quatro dias",
  config: { answers: ["sim", "não"] },
  children: [],
  childrenStats: { count: 0 },
  tags: [],
  excerpt: "Devemos adotar a semana de quatro dias?"
}

const post = {
  ...author,
  type: "post",
  id: 5,
  title: "A favor",
  body: "O resumo do post.",
  config: { answer: "sim" },
  topic: { id: 1, title: "Semana de quatro dias" },
  excerpt: "mais adiante, com quatro dias de trabalho"
}

const TAGS = [
  { slug: "politica", name: "Política", provisional: false, topics: 7 },
  { slug: "trabalho", name: "Trabalho", provisional: false, topics: 3 }
]

// GET /search answers `answer`; GET /tags (the autocomplete) the TAGS containing `q`
function mockApi(answer = { results: [topic, post], count: 2, tags: [] }) {
  const fetch = vi.fn(async url => {
    const { pathname, searchParams } = new URL(url)
    const body = pathname === "/tags" ?
      { tags: TAGS.filter(tag => tag.slug.includes(searchParams.get("q"))), count: 2 }
      :
      answer
    return { ok: true, status: 200, json: async () => body }
  })
  vi.stubGlobal("fetch", fetch)
  return fetch
}

const searches = fetch => fetch.mock.calls.map(([url]) => new URL(url)).filter(url => url.pathname === "/search")

function Location() {
  const location = useLocation()
  return <p data-testid="location">{location.pathname}{location.search}</p>
}

const renderPage = (url, element = <Search />) => render(
  <UserContext.Provider value={{ user: null }}>
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="*" element={<>{element}<Location /></>} />
      </Routes>
    </MemoryRouter>
  </UserContext.Provider>
)

describe("Search", () => {
  it("asks the API for the query and type in the address", async () => {
    const fetch = mockApi()
    renderPage("/search?q=quatro%20dias&type=post&p=2")

    await screen.findByText("A favor")
    const url = new URL(fetch.mock.calls[0][0])
    expect(url.pathname).toBe("/search")
    expect(Object.fromEntries(url.searchParams)).toEqual({ q: "quatro dias", type: "post", page: "2", pageSize: "10" })
  })

  it("shows topics and posts with their matched passage marked", async () => {
    mockApi()
    renderPage("/search?q=quatro")

    expect(await screen.findByText("2 resultados para", { exact: false })).toBeInTheDocument()
    // The topic's title, and the post's link to the topic it answers
    expect(screen.getAllByRole("link", { name: "Semana de quatro dias" }).map(link => link.getAttribute("href"))).toEqual(["/topics/1", "/topics/1"])
    expect(screen.getByRole("link", { name: "A favor" })).toHaveAttribute("href", "/topics/1/posts/5")

    const excerpts = document.querySelectorAll(".searchExcerpt")
    expect(excerpts).toHaveLength(2)
    expect([...document.querySelectorAll(".searchExcerpt mark")].map(mark => mark.textContent)).toEqual(["quatro", "quatro"])
    // The passage replaces the post's summary
    expect(screen.queryByText("O resumo do post.")).toBeNull()
  })

  it("keeps a post's summary when only its title matched", async () => {
    mockApi({ results: [{ ...post, excerpt: "O resumo do post." }], count: 1 })
    renderPage("/search?q=favor")

    expect(await screen.findByText("O resumo do post.")).toBeInTheDocument()
    expect(document.querySelector(".searchExcerpt")).toBeNull()
  })

  it("never renders an excerpt as HTML", async () => {
    mockApi({ results: [{ ...post, excerpt: "<img src=x onerror=alert(1)> a" }], count: 1 })
    renderPage("/search?q=a")

    await screen.findByText("A favor")
    expect(document.querySelector(".searchExcerpt img")).toBeNull()
    expect(document.querySelector(".searchExcerpt").textContent).toBe("<img src=x onerror=alert(1)> a")
  })

  it("says when nothing matched", async () => {
    mockApi({ results: [], count: 0 })
    renderPage("/search?q=xyz")

    expect(await screen.findByText(/nada encontrado para “xyz”/)).toBeInTheDocument()
  })

  it("shows the API's refusal", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => ({ ok: false, status: 400, json: async () => ({ message: "Busca: máximo de 200 caracteres." }) })))
    renderPage("/search?q=a")

    expect(await screen.findByText("Busca: máximo de 200 caracteres.")).toBeInTheDocument()
  })

  it("asks for nothing without a query or tags", () => {
    const fetch = mockApi()
    renderPage("/search")

    expect(screen.getByText(/use # para buscar por tags/)).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("searches by tags alone, showing them named once the API answers", async () => {
    const fetch = mockApi({ results: [topic], count: 1, tags: [{ slug: "politica", name: "Política", provisional: false }] })
    renderPage("/search?tags=politica,trabalho")

    expect(await screen.findByText("#Política #trabalho")).toBeInTheDocument()
    expect(Object.fromEntries(searches(fetch)[0].searchParams)).toEqual({ tags: "politica,trabalho", page: "1", pageSize: "10" })
    const pills = within(screen.getByRole("list", { name: "tags da busca" })).getAllByRole("listitem")
    expect(pills.map(pill => pill.textContent)).toEqual(["#Política", "#trabalho"])
  })

  it("links each type to the same query", async () => {
    mockApi()
    renderPage("/search?q=quatro&tags=trabalho&type=topic")

    const types = within(screen.getByRole("group", { name: "mostrar" }))
    expect(types.getByRole("link", { name: "tudo" })).toHaveAttribute("href", "/search?q=quatro&tags=trabalho")
    expect(types.getByRole("link", { name: "posts" })).toHaveAttribute("href", "/search?q=quatro&tags=trabalho&type=post")
    expect(types.getByRole("link", { name: "tópicos" })).toHaveAttribute("aria-current", "page")
    await screen.findByText("A favor")
  })

  it("searches again from its field, keeping the type", async () => {
    mockApi()
    renderPage("/search?q=quatro&type=post")

    const field = screen.getByRole("combobox", { name: "buscar" })
    expect(field).toHaveValue("quatro")
    await userEvent.clear(field)
    await userEvent.type(field, "cinco dias{Enter}")

    expect(screen.getByTestId("location")).toHaveTextContent("/search?q=cinco+dias&type=post")
  })
})

describe("SearchBox", () => {
  const field = () => screen.getByRole("combobox", { name: "buscar" })
  const pills = () => within(screen.queryByRole("list", { name: "tags da busca" }) ?? document.createElement("ul"))
    .queryAllByRole("listitem").map(pill => pill.textContent)
  const location = () => screen.getByTestId("location").textContent

  it("opens the search page with what was typed, trimmed, and ignores blanks", async () => {
    renderPage("/recent", <SearchBox />)

    await userEvent.type(field(), "   {Enter}")
    expect(location()).toBe("/recent")

    await userEvent.type(field(), " reforma {Enter}")
    expect(location()).toBe("/search?q=reforma")
  })

  it("suggests tags only after a #", async () => {
    const fetch = mockApi()
    renderPage("/recent", <SearchBox />)

    await userEvent.type(field(), "pol")
    await new Promise(resolve => setTimeout(resolve, 250))
    expect(screen.queryByRole("listbox")).toBeNull()
    expect(fetch).not.toHaveBeenCalled()

    await userEvent.type(field(), " #pol")
    const options = within(await screen.findByRole("listbox", { name: "tags sugeridas" })).getAllByRole("option")
    expect(options.map(option => option.textContent)).toEqual(["#Política7 tópicos"])
    expect(field()).toHaveAttribute("aria-expanded", "true")
  })

  it("turns a picked tag into a pill, and searches the words and the tags' intersection", async () => {
    mockApi()
    renderPage("/recent", <SearchBox type="topic" />)

    await userEvent.type(field(), "salário #pol")
    await userEvent.click(await screen.findByRole("option", { name: /Política/ }))
    expect(pills()).toEqual(["#Política"])
    expect(field()).toHaveValue("salário ")

    // Enter picks the highlighted suggestion while the list is open; then it searches
    await userEvent.type(field(), "#tra")
    await screen.findByRole("option", { name: /Trabalho/ })
    await userEvent.keyboard("{ArrowDown}{Enter}")
    expect(pills()).toEqual(["#Política", "#Trabalho"])
    expect(screen.queryByRole("listbox")).toBeNull()

    await userEvent.keyboard("{Enter}")
    expect(location()).toBe("/search?q=sal%C3%A1rio&tags=politica%2Ctrabalho&type=topic")
  })

  it("doesn't offer a tag already picked, and Escape closes the suggestions", async () => {
    mockApi()
    renderPage("/recent", <SearchBox initialTags={[{ slug: "politica", name: "Política" }]} />)

    await userEvent.type(field(), "#")
    const options = within(await screen.findByRole("listbox")).getAllByRole("option")
    expect(options.map(option => option.textContent)).toEqual(["#Trabalho3 tópicos"])

    await userEvent.keyboard("{Escape}")
    expect(screen.queryByRole("listbox")).toBeNull()
  })

  it("counts a #tag typed in full, and searches tags alone", async () => {
    renderPage("/recent", <SearchBox />)

    await userEvent.type(field(), "#Meio-Ambiente #politica")
    await userEvent.click(screen.getByRole("button", { name: "buscar" }))
    expect(location()).toBe("/search?tags=meio-ambiente%2Cpolitica")
  })

  it("removes a pill by its button or by Backspace at the start of the field", async () => {
    mockApi()
    renderPage("/recent", <SearchBox initialQuery="a" initialTags={[{ slug: "politica", name: "Política" }, { slug: "trabalho" }]} />)
    expect(pills()).toEqual(["#Política", "#trabalho"])

    await userEvent.click(screen.getByRole("button", { name: "remover #Política" }))
    expect(pills()).toEqual(["#trabalho"])

    field().setSelectionRange(0, 0)
    await userEvent.keyboard("{Backspace}")
    expect(pills()).toEqual([])
    expect(field()).toHaveValue("a")
  })
})
