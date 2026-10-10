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

function mockApi(answer = { results: [topic, post], count: 2 }) {
  const fetch = vi.fn(async () => ({ ok: true, status: 200, json: async () => answer }))
  vi.stubGlobal("fetch", fetch)
  return fetch
}

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

  it("asks for nothing without a query", () => {
    const fetch = mockApi()
    renderPage("/search")

    expect(screen.getByText(/busque por título, tag ou trecho do texto/)).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("links each type to the same query", async () => {
    mockApi()
    renderPage("/search?q=quatro&type=topic")

    const types = within(screen.getByRole("group", { name: "mostrar" }))
    expect(types.getByRole("link", { name: "tudo" })).toHaveAttribute("href", "/search?q=quatro")
    expect(types.getByRole("link", { name: "posts" })).toHaveAttribute("href", "/search?q=quatro&type=post")
    expect(types.getByRole("link", { name: "tópicos" })).toHaveAttribute("aria-current", "page")
    await screen.findByText("A favor")
  })

  it("searches again from its field, keeping the type", async () => {
    mockApi()
    renderPage("/search?q=quatro&type=post")

    const field = screen.getByRole("searchbox", { name: "buscar" })
    expect(field).toHaveValue("quatro")
    await userEvent.clear(field)
    await userEvent.type(field, "cinco dias{Enter}")

    expect(screen.getByTestId("location")).toHaveTextContent("/search?q=cinco+dias&type=post")
  })
})

describe("SearchBox", () => {
  it("opens the search page with what was typed, trimmed, and ignores blanks", async () => {
    renderPage("/recent", <SearchBox />)
    const field = screen.getByRole("searchbox", { name: "buscar" })

    await userEvent.type(field, "   {Enter}")
    expect(screen.getByTestId("location")).toHaveTextContent("/recent")

    await userEvent.type(field, " reforma {Enter}")
    expect(screen.getByTestId("location")).toHaveTextContent("/search?q=reforma")
  })
})
