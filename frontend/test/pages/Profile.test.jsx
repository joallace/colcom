// The profile page against a mocked API: the logged in user's (/profile) and anyone's (/users/:name)
import { fireEvent, render, screen, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { describe, expect, it, vi } from "vitest"

import Profile from "@/pages/Profile"
import { UserContext } from "@/context/UserContext"


const API = "http://api.test"

const ALICE = { pid: "a1", name: "alice", avatar: "AAAA", prestige: 0, created_at: "2026-01-01T00:00:00Z" }
const BOB = { pid: "b2", name: "bob silva", avatar: "BBBB", prestige: 10, created_at: "2026-02-01T00:00:00Z" }

// Bob's awards, newest first: one held back by the limit on awards from one person
const BOB_AWARDS = [
  {
    id: 2, reason: "suggestion_merged", amount: 0, rule_amount: 5, limited: "pair", created_at: "2026-03-02T00:00:00Z",
    counterpart: { pid: "a1", name: "alice" }, critique: null, post: { id: 6, title: "Contra" }, topic: { id: 1, title: "Tópico" },
    suggestion: { id: 9, message: "Corrige a data" }
  },
  {
    id: 1, reason: "critique_fixed", amount: 10, rule_amount: 10, limited: null, created_at: "2026-03-01T00:00:00Z",
    counterpart: { pid: "a1", name: "alice" }, critique: { id: 7, title: "Falta a fonte" }, post: { id: 6, title: "Contra" }, topic: { id: 1, title: "Tópico" },
    suggestion: null
  }
]

const post = (author) => ({
  type: "post",
  id: 5,
  title: `Post by ${author.name}`,
  body: "Resumo",
  author: author.name,
  author_avatar: author.avatar,
  upvotes: 0,
  downvotes: 0,
  config: { answer: "sim" },
  topic: { id: 1, title: "Tópico" }
})

function mockApi() {
  const fetch = vi.fn(async url => {
    const { pathname, searchParams } = new URL(url)
    const user = [ALICE, BOB].find(user => pathname === `/users/${encodeURIComponent(user.name)}`)
    if (user)
      return { ok: true, status: 200, json: async () => user }
    const earner = [ALICE, BOB].find(user => pathname === `/users/${encodeURIComponent(user.name)}/prestige`)
    if (earner) {
      const events = earner === BOB ? BOB_AWARDS : []
      return { ok: true, status: 200, json: async () => ({ prestige: earner.prestige, events, count: events.length }) }
    }
    if (pathname === "/contents") {
      const author = [ALICE, BOB].find(user => user.pid === searchParams.get("authorId"))
      // Bob has a single post
      const has = author === BOB && [null, "post"].includes(searchParams.get("type"))
      return { ok: true, status: 200, json: async () => ({ contents: has ? [post(BOB)] : [], count: has ? 1 : 0 }) }
    }
    return { ok: false, status: 404, json: async () => ({ message: "Usuário não encontrado." }) }
  })
  vi.stubGlobal("fetch", fetch)
  return fetch
}

function LoginPage() {
  const { search } = useLocation()
  return <p>login page{search}</p>
}

const renderPage = (url, user) => {
  // The API client reads the token where UserProvider keeps it
  if (user?.accessToken)
    localStorage.setItem("accessToken", user.accessToken)
  return render(
    <UserContext.Provider value={{ user }}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/profile" element={<Profile />} />
          <Route path="/users/:name" element={<Profile />} />
          <Route path="/login" element={<LoginPage />} />
        </Routes>
      </MemoryRouter>
    </UserContext.Provider>
  )
}

describe("Profile", () => {
  it("shows the logged in user on /profile", async () => {
    const fetch = mockApi()
    renderPage("/profile", { ...ALICE, accessToken: "token-123" })

    expect(await screen.findByText("você ainda não publicou nenhum conteúdo.")).toBeInTheDocument()
    expect(screen.getByText("alice")).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(`${API}/contents?authorId=a1&page=1&pageSize=5`, expect.objectContaining({ method: "GET", headers: { Authorization: "Bearer token-123" } }))
  })

  it("sends logged out visitors of /profile to the login", async () => {
    mockApi()
    renderPage("/profile", null)

    expect(await screen.findByText("login page?returnTo=%2Fprofile")).toBeInTheDocument()
  })

  it("shows anyone's profile and contents by name, without logging in", async () => {
    const fetch = mockApi()
    renderPage("/users/bob%20silva", null)

    expect(await screen.findByText("Post by bob silva")).toBeInTheDocument()
    expect(screen.getAllByText("bob silva")[0]).toHaveClass("username")
    expect(fetch).toHaveBeenCalledWith(`${API}/users/bob%20silva`, expect.objectContaining({ method: "GET" }))
    expect(fetch).toHaveBeenCalledWith(`${API}/contents?authorId=b2&page=1&pageSize=5`, expect.objectContaining({ method: "GET", headers: {} }))
  })

  it("names someone else when they have published nothing", async () => {
    mockApi()
    renderPage("/users/alice", { ...BOB, accessToken: "token-456" })

    expect(await screen.findByText("alice ainda não publicou nenhum conteúdo.")).toBeInTheDocument()
  })

  it("filters the contents by type, from the address", async () => {
    const fetch = mockApi()
    renderPage("/users/bob%20silva?type=critique", null)

    expect(await screen.findByText("bob silva ainda não publicou nenhuma crítica.")).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(`${API}/contents?authorId=b2&type=critique&page=1&pageSize=5`, expect.anything())

    const types = within(screen.getByRole("group", { name: "mostrar" }))
    expect(types.getByRole("link", { name: "críticas" })).toHaveAttribute("aria-current", "page")
    expect(types.getByRole("link", { name: "tudo" })).toHaveAttribute("href", "/users/bob%20silva")
    expect(types.getByRole("link", { name: "tópicos" })).toHaveAttribute("href", "/users/bob%20silva?type=topic")
  })

  it("keeps the profile and the pills in place while another type loads", async () => {
    const fetch = mockApi()
    const { container } = renderPage("/users/bob%20silva", null)
    expect(await screen.findByText("Post by bob silva")).toBeInTheDocument()

    // The next contents never arrive
    const answer = fetch.getMockImplementation()
    fetch.mockImplementation(async (url, options) =>
      new URL(url).searchParams.get("type") ? new Promise(() => {}) : answer(url, options))
    fireEvent.click(screen.getByRole("link", { name: "críticas" }))

    expect(await screen.findByRole("link", { name: "críticas" })).toHaveAttribute("aria-current", "page")
    expect(screen.queryByText("Post by bob silva")).not.toBeInTheDocument()
    expect(container.querySelector(".profileCard")).toBeInTheDocument()
    expect(container.querySelector(".tree .centeredSpinner .spinner")).toBeInTheDocument()
  })

  it("shows everything for an unknown type", async () => {
    const fetch = mockApi()
    renderPage("/profile?type=suggestion", { ...ALICE, accessToken: "token-123" })

    expect(await screen.findByText("você ainda não publicou nenhum conteúdo.")).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(`${API}/contents?authorId=a1&page=1&pageSize=5`, expect.anything())
    expect(screen.getByRole("link", { name: "tudo" })).toHaveAttribute("aria-current", "page")
  })

  it("shows the user's prestige, leading to where it came from", async () => {
    mockApi()
    renderPage("/users/bob%20silva", null)

    const total = await screen.findByRole("link", { name: "10 de prestígio" })
    expect(total).toHaveAttribute("href", "/users/bob%20silva?type=prestige")
  })

  it("lists where each point of someone's prestige came from", async () => {
    const fetch = mockApi()
    renderPage("/users/bob%20silva?type=prestige", null)

    const history = await screen.findByRole("list", { name: "histórico de prestígio" })
    const [held, fixed] = within(history).getAllByRole("listitem")

    expect(fixed).toHaveTextContent("+10crítica que levou a uma correção: Falta a fonte")
    expect(within(fixed).getByRole("link", { name: "Falta a fonte" })).toHaveAttribute("href", "/topics/1/posts/6?critique=7")
    expect(fixed).toHaveTextContent("em Contra")
    expect(fixed).toHaveTextContent("corrigida por alice")
    expect(within(fixed).getByRole("link", { name: "alice" })).toHaveAttribute("href", "/users/alice")

    expect(held).toHaveTextContent("+0sugestão incorporada: Contra")
    expect(held).toHaveTextContent("Corrige a data")
    expect(within(held).getByRole("link", { name: "0 de 5 creditados: limite de prêmios da mesma pessoa" })).toHaveAttribute("href", "/prestige")

    expect(screen.getByRole("link", { name: "Como funciona o prestígio" })).toHaveAttribute("href", "/prestige")
    expect(screen.getByRole("link", { name: "prestígio" })).toHaveAttribute("aria-current", "page")
    expect(fetch).toHaveBeenCalledWith(`${API}/users/bob%20silva/prestige?page=1&pageSize=5`, expect.anything())
    expect(fetch.mock.calls.some(([url]) => url.includes("/contents"))).toBe(false)
  })

  it("says when the user hasn't earned any prestige", async () => {
    mockApi()
    renderPage("/profile?type=prestige", { ...ALICE, accessToken: "token-123" })

    expect(await screen.findByText("você ainda não conquistou prestígio.")).toBeInTheDocument()
  })

  it("says so for an unknown name", async () => {
    mockApi()
    renderPage("/users/nobody", null)

    expect(await screen.findByText("usuário não encontrado.")).toBeInTheDocument()
  })
})
