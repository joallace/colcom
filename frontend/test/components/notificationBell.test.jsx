// The navbar's bell and its popover with the latest notifications, against a mocked API
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { describe, expect, it, vi } from "vitest"

import NotificationBell from "@/components/layout/NotificationBell"
import { UserContext } from "@/context/UserContext"


const API = "http://api.test"
const USER = { name: "alice", accessToken: "token-1" }

const notification = (id, read = true) => ({
  id,
  type: "critique",
  read,
  created_at: new Date().toISOString(),
  actor: { name: "bob", avatar: "BBBB" },
  content: { id: 5, title: `Post ${id}`, type: "post" },
  topic_id: 1,
  subject: { id: 100 + id, title: "Discordo", type: "critique", commit: "abc123" },
  suggestion: null
})

function mockApi({ notifications = [notification(2, false), notification(1)], unread = 1, ok = true } = {}) {
  const fetch = vi.fn(async (url, options) => {
    const { pathname } = new URL(url)
    if (pathname === "/notifications")
      return { ok, status: ok ? 200 : 500, json: async () => ({ notifications, count: notifications.length, unread }) }
    if (pathname === "/notifications/unread")
      return { ok: true, status: 200, json: async () => ({ unread }) }
    if (pathname === "/notifications/read") {
      const { ids } = JSON.parse(options.body)
      unread -= ids.length
      return { ok: true, status: 200, json: async () => ({ read: ids.length, unread }) }
    }
    return { ok: false, status: 404, json: async () => ({}) }
  })
  vi.stubGlobal("fetch", fetch)
  return fetch
}

function Where() {
  const { pathname, search } = useLocation()
  return <p>at {pathname}{search}</p>
}

const renderBell = () => render(
  <UserContext.Provider value={{ user: USER }}>
    <MemoryRouter initialEntries={["/"]}>
      <NotificationBell />
      <Routes>
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  </UserContext.Provider>
)

const listCalls = fetch => fetch.mock.calls.filter(([url]) => new URL(url).pathname === "/notifications")

describe("the notification bell", () => {
  it("shows the unread count and fetches nothing else until opened", async () => {
    const fetch = mockApi({ unread: 3 })
    renderBell()

    expect(await screen.findByRole("button", { name: "notificações, 3 não lidas" })).toHaveTextContent("3")
    expect(listCalls(fetch)).toHaveLength(0)
  })

  it("opens the latest 5 notifications, with a link to all of them", async () => {
    const fetch = mockApi()
    renderBell()

    await userEvent.click(await screen.findByRole("button", { name: /^notificações/ }))
    const dialog = screen.getByRole("dialog", { name: "notificações" })

    expect(await within(dialog).findByRole("link", { name: "Post 2" })).toHaveAttribute("href", "/topics/1/posts/5?commit=abc123&critique=102")
    expect(within(dialog).getByRole("link", { name: "Post 2" }).closest("li")).toHaveClass("unread")
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(2)
    expect(within(dialog).getByRole("link", { name: "ver todas as notificações" })).toHaveAttribute("href", "/notifications")

    const [[url]] = listCalls(fetch)
    expect(new URL(url).searchParams.get("pageSize")).toBe("5")
    expect(new URL(url).searchParams.get("page")).toBe("1")
  })

  it("marks an unread one read when it's opened, and closes", async () => {
    const fetch = mockApi()
    renderBell()

    await userEvent.click(await screen.findByRole("button", { name: /^notificações/ }))
    await userEvent.click(await screen.findByRole("link", { name: "Post 2" }))

    expect(screen.getByText("at /topics/1/posts/5?commit=abc123&critique=102")).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    const read = fetch.mock.calls.find(([url]) => url === `${API}/notifications/read`)
    expect(JSON.parse(read[1].body)).toEqual({ ids: [2] })
    // The badge follows the count the API answers with
    await waitFor(() => expect(screen.getByRole("button", { name: "notificações" })).not.toHaveTextContent(/\d/))
  })

  it("doesn't mark read ones again", async () => {
    const fetch = mockApi()
    renderBell()

    await userEvent.click(await screen.findByRole("button", { name: /^notificações/ }))
    await userEvent.click(await screen.findByRole("link", { name: "Post 1" }))

    expect(fetch.mock.calls.some(([url]) => url === `${API}/notifications/read`)).toBe(false)
  })

  it("goes to the notifications page from its link", async () => {
    mockApi()
    renderBell()

    await userEvent.click(await screen.findByRole("button", { name: /^notificações/ }))
    await userEvent.click(screen.getByRole("link", { name: "ver todas as notificações" }))

    expect(screen.getByText("at /notifications")).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("fetches again each time it opens", async () => {
    const fetch = mockApi()
    renderBell()
    const bell = await screen.findByRole("button", { name: /^notificações/ })

    await userEvent.click(bell)
    await screen.findByRole("link", { name: "Post 2" })
    await userEvent.click(bell)
    await userEvent.click(bell)
    await screen.findByRole("link", { name: "Post 2" })

    expect(listCalls(fetch)).toHaveLength(2)
  })

  it("says when there's nothing, or when it couldn't load them", async () => {
    mockApi({ notifications: [], unread: 0 })
    const { unmount } = renderBell()

    await userEvent.click(await screen.findByRole("button", { name: "notificações" }))
    expect(await screen.findByText("nenhuma notificação por aqui.")).toBeInTheDocument()
    unmount()

    mockApi({ ok: false, unread: 0 })
    renderBell()
    await userEvent.click(await screen.findByRole("button", { name: "notificações" }))
    expect(await screen.findByText("não foi possível carregar as notificações.")).toBeInTheDocument()
  })
})
