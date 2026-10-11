// The podium page against a mocked API: users by prestige beside topics or posts by relevance
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { describe, expect, it, vi } from "vitest"

import Podium from "@/pages/Podium"


const user = (name, prestige, position) => ({ pid: `pid-${name}`, name, avatar: "AAAA", prestige, position })

const content = (id, title, score, position, extra = {}) => ({
  id, title, score, position, upvotes: score + 1, downvotes: 1,
  author: "alice", author_id: "pid-alice", author_avatar: "AAAA", created_at: "2026-10-01T00:00:00.000Z",
  ...extra
})

const USERS = [user("bia", 12, 1), user("caio", 7, 2)]
const TOPICS = [
  content(1, "Semana de quatro dias", 9, 1),
  content(2, "Renda básica", 4, 2),
  content(3, "Voto obrigatório", 4, 2),
  content(4, "Tarifa zero", 1, 4)
]
const POSTS = [content(10, "A favor", 3, 1, { config: { answer: "sim" }, topic: { id: 1, title: "Semana de quatro dias" } })]

// GET /podium/users answers `users`; GET /podium/contents what `contents` has for its "type:period"
function mockApi({ users = USERS, contents = { "topic:week": TOPICS } } = {}) {
  const fetch = vi.fn(async url => {
    const { pathname, searchParams } = new URL(url)
    const body = pathname === "/podium/users" ?
      { users }
      :
      { contents: contents[`${searchParams.get("type")}:${searchParams.get("period")}`] ?? [] }
    return { ok: true, status: 200, json: async () => body }
  })
  vi.stubGlobal("fetch", fetch)
  return fetch
}

const renderAt = url => render(
  <MemoryRouter initialEntries={[url]}>
    <Routes>
      <Route path="/podium" element={<Podium />} />
    </Routes>
  </MemoryRouter>
)

const standings = async name => within(await screen.findByRole("list", { name })).getAllByRole("listitem")
const contentRequests = fetch => fetch.mock.calls.map(([url]) => url).filter(url => url.includes("/podium/contents"))

describe("the podium page", () => {
  it("shows the users with the most prestige beside the week's most relevant topics", async () => {
    const fetch = mockApi()
    renderAt("/podium")

    const users = await standings("usuários por prestígio")
    expect(within(screen.getByRole("region", { name: "prestígio" })).getByRole("list")).toBeInTheDocument()
    // The medal is named for screen readers
    expect(users.map(item => item.textContent)).toEqual(["bia1º12prestígio", "caio2º7prestígio"])
    expect(within(users[0]).getByRole("link", { name: "bia" })).toHaveAttribute("href", "/users/bia")

    const topics = await standings("tópicos por relevância")
    expect(within(screen.getByRole("region", { name: "relevância" })).getByRole("list")).toBeInTheDocument()
    expect(topics.map(item => within(item).getByRole("link", { name: /^(?!alice)/ }).getAttribute("href"))).toEqual(["/topics/1", "/topics/2", "/topics/3", "/topics/4"])
    // Equal balances share a position; the fourth is in a row under the steps
    expect(topics.map(item => item.getAttribute("value"))).toEqual(["1", "2", "2", "4"])
    expect(topics[3]).toHaveClass("row")
    expect(topics[0]).toHaveTextContent("+9")
    expect(topics[0]).toHaveTextContent("10 acharam relevante, 1 não")
    expect(within(topics[0]).getByRole("link", { name: "alice" })).toHaveAttribute("href", "/users/alice")

    expect(screen.getByText(/recebidos nos últimos 7 dias; o voto do próprio autor não conta/)).toBeInTheDocument()
    expect(contentRequests(fetch)).toEqual(["http://api.test/podium/contents?type=topic&period=week"])
    expect(document.title).toBe("pódio · colcom")
  })

  it("switches to posts and to another period through the address", async () => {
    const fetch = mockApi({ contents: { "topic:week": TOPICS, "post:week": POSTS, "post:all": [{ ...POSTS[0], score: 5 }] } })
    renderAt("/podium")
    await standings("tópicos por relevância")

    expect(screen.getByRole("link", { name: "posts" })).toHaveAttribute("href", "/podium?type=post")
    await userEvent.click(screen.getByRole("link", { name: "posts" }))

    const [post] = await standings("posts por relevância")
    expect(within(post).getByRole("link", { name: "A favor" })).toHaveAttribute("href", "/topics/1/posts/10")
    expect(post).toHaveTextContent("em Semana de quatro dias com sim")
    expect(within(post).getByRole("link", { name: "Semana de quatro dias" })).toHaveAttribute("href", "/topics/1")
    expect(screen.getByRole("link", { name: "posts" })).toHaveAttribute("aria-current", "page")

    expect(screen.getByRole("link", { name: "sempre" })).toHaveAttribute("href", "/podium?type=post&period=all")
    await userEvent.click(screen.getByRole("link", { name: "sempre" }))

    expect(await screen.findByText("+5")).toBeInTheDocument()
    expect(screen.getByText(/recebidos desde o início/)).toBeInTheDocument()
    expect(contentRequests(fetch)).toEqual([
      "http://api.test/podium/contents?type=topic&period=week",
      "http://api.test/podium/contents?type=post&period=week",
      "http://api.test/podium/contents?type=post&period=all"
    ])
    // The users don't depend on either
    expect(fetch.mock.calls.filter(([url]) => url.endsWith("/podium/users"))).toHaveLength(1)
  })

  it("says why a column is empty, offering every vote when a period had none", async () => {
    mockApi({ users: [], contents: {} })
    renderAt("/podium?period=month")

    expect(await screen.findByText("ninguém conquistou prestígio ainda.")).toBeInTheDocument()
    expect(await screen.findByText(/nenhum tópico recebeu mais votos de relevância a favor que contra nos últimos 30 dias/)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "ver desde o início" })).toHaveAttribute("href", "/podium?period=all")
  })

  it("doesn't offer every vote when it already counts them", async () => {
    mockApi({ contents: {} })
    renderAt("/podium?type=post&period=all")

    expect(await screen.findByText(/nenhum post recebeu mais votos de relevância a favor que contra desde o início/)).toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "ver desde o início" })).toBeNull()
  })

  it("says so when the API can't be reached", async () => {
    vi.spyOn(console, "error").mockImplementation(() => { })
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch") }))
    renderAt("/podium")

    expect(await screen.findAllByText("não foi possível se conectar ao colcom.")).toHaveLength(2)
  })
})
