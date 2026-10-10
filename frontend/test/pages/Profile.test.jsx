// The profile page against a mocked API: the logged in user's (/profile) and anyone's (/users/:name)
import { render, screen } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { describe, expect, it, vi } from "vitest"

import Profile from "@/pages/Profile"
import { UserContext } from "@/context/UserContext"


const API = "http://api.test"

const ALICE = { pid: "a1", name: "alice", avatar: "AAAA", created_at: "2026-01-01T00:00:00Z" }
const BOB = { pid: "b2", name: "bob silva", avatar: "BBBB", created_at: "2026-02-01T00:00:00Z" }

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
    if (pathname === "/contents") {
      const author = [ALICE, BOB].find(user => user.pid === searchParams.get("authorId"))
      return { ok: true, status: 200, json: async () => ({ contents: author === BOB ? [post(BOB)] : [], count: author === BOB ? 1 : 0 }) }
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

  it("says so for an unknown name", async () => {
    mockApi()
    renderPage("/users/nobody", null)

    expect(await screen.findByText("usuário não encontrado.")).toBeInTheDocument()
  })
})
