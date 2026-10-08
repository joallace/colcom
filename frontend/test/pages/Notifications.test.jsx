// The notifications page and the navbar's unread count, against a mocked API
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { describe, expect, it, vi } from "vitest"

import Notifications from "@/pages/Notifications"
import { UserContext } from "@/context/UserContext"
import useUnreadNotifications from "@/hooks/useUnreadNotifications"
import { announceUnread } from "@/assets/notifications"


const API = "http://api.test"
const USER = { name: "alice", accessToken: "token-1" }

const critique = {
  id: 2,
  type: "critique",
  read: false,
  created_at: new Date().toISOString(),
  actor: { name: "bob", avatar: "BBBB" },
  content: { id: 5, title: "Meu post", type: "post" },
  topic_id: 1,
  subject: { id: 9, title: "Discordo", type: "critique", commit: "abc123" },
  suggestion: null
}
const accepted = {
  ...critique,
  id: 1,
  type: "suggestion_accepted",
  read: true,
  subject: null,
  suggestion: { message: "Corrige a introdução", commit: "def456" }
}

function mockApi({ notifications = [critique, accepted], unread = 1 } = {}) {
  const fetch = vi.fn(async (url, options) => {
    const { pathname } = new URL(url)
    if (pathname === "/notifications")
      return { ok: true, status: 200, json: async () => ({ notifications, count: notifications.length, unread }) }
    if (pathname === "/notifications/read") {
      const { ids } = JSON.parse(options.body)
      return { ok: true, status: 200, json: async () => ({ read: ids?.length ?? unread, unread: ids ? unread - ids.length : 0 }) }
    }
    if (pathname === "/notifications/unread")
      return { ok: true, status: 200, json: async () => ({ unread }) }
    return { ok: false, status: 404, json: async () => ({}) }
  })
  vi.stubGlobal("fetch", fetch)
  return fetch
}

function Where() {
  const { pathname, search } = useLocation()
  return <p>at {pathname}{search}</p>
}

const renderPage = (user = USER) => render(
  <UserContext.Provider value={{ user }}>
    <MemoryRouter initialEntries={["/notifications"]}>
      <Routes>
        <Route path="/notifications" element={<Notifications />} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  </UserContext.Provider>
)

const readCalls = fetch => fetch.mock.calls.filter(([url]) => url === `${API}/notifications/read`)

describe("the notifications page", () => {
  it("lists what happened, with the unread ones marked", async () => {
    const fetch = mockApi()
    renderPage()

    const critiqueItem = (await screen.findByText("criticou seu post", { exact: false })).closest("li")
    expect(critiqueItem).toHaveClass("unread")
    expect(critiqueItem).toHaveTextContent("bob criticou seu post Meu post (não lida)")
    expect(within(critiqueItem).getByRole("link", { name: "bob" })).toHaveAttribute("href", "/users/bob")
    expect(within(critiqueItem).getByRole("link", { name: "Meu post" })).toHaveAttribute("href", "/topics/1/posts/5?commit=abc123&critique=9")

    const acceptedItem = screen.getByText("Corrige a introdução").closest("li")
    expect(acceptedItem).not.toHaveClass("unread")
    expect(acceptedItem).toHaveTextContent("bob aceitou sua sugestão para Meu post")

    expect(fetch).toHaveBeenCalledWith(`${API}/notifications?page=1&pageSize=20`, { headers: { Authorization: "Bearer token-1" } })
  })

  it("marks one as read when it's opened, and goes where it leads", async () => {
    const fetch = mockApi()
    renderPage()

    const [critiqueLink] = await screen.findAllByRole("link", { name: "Meu post" })
    await userEvent.click(critiqueLink)

    expect(await screen.findByText("at /topics/1/posts/5?commit=abc123&critique=9")).toBeInTheDocument()
    expect(readCalls(fetch).map(([, options]) => options.body)).toEqual([JSON.stringify({ ids: [2] })])
  })

  it("doesn't mark again one already read", async () => {
    const fetch = mockApi()
    renderPage()

    const [, acceptedLink] = await screen.findAllByRole("link", { name: "Meu post" })
    await userEvent.click(acceptedLink)

    await screen.findByText("at /topics/1/posts/5")
    expect(readCalls(fetch)).toHaveLength(0)
  })

  it("marks all as read", async () => {
    const fetch = mockApi()
    renderPage()

    await userEvent.click(await screen.findByRole("button", { name: "marcar todas como lidas" }))

    await waitFor(() => expect(screen.queryByRole("button", { name: "marcar todas como lidas" })).not.toBeInTheDocument())
    expect(document.querySelector("li.unread")).toBeNull()
    expect(readCalls(fetch).map(([, options]) => options.body)).toEqual(["{}"])
  })

  it("says when there are none", async () => {
    mockApi({ notifications: [], unread: 0 })
    renderPage()

    expect(await screen.findByText(/nenhuma notificação por aqui/)).toBeInTheDocument()
    expect(screen.queryByRole("button")).not.toBeInTheDocument()
  })

  it("sends a logged out visitor to the login, to come back after", async () => {
    const fetch = mockApi()
    renderPage(null)

    expect(await screen.findByText("at /login?returnTo=%2Fnotifications")).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })
})

describe("useUnreadNotifications", () => {
  function Badge() {
    return <span data-testid="unread">{useUnreadNotifications()}</span>
  }

  const renderBadge = user => render(
    <UserContext.Provider value={{ user }}>
      <MemoryRouter><Badge /></MemoryRouter>
    </UserContext.Provider>
  )

  it("asks the API for the logged in user's count", async () => {
    const fetch = mockApi({ unread: 4 })
    renderBadge(USER)

    await waitFor(() => expect(screen.getByTestId("unread")).toHaveTextContent("4"))
    expect(fetch).toHaveBeenCalledWith(`${API}/notifications/unread`, { headers: { Authorization: "Bearer token-1" } })
  })

  it("follows what a page announces", async () => {
    mockApi({ unread: 4 })
    renderBadge(USER)
    await waitFor(() => expect(screen.getByTestId("unread")).toHaveTextContent("4"))

    announceUnread(1)
    await waitFor(() => expect(screen.getByTestId("unread")).toHaveTextContent("1"))
  })

  it("is zero, without asking, when logged out", async () => {
    const fetch = mockApi({ unread: 4 })
    renderBadge(null)

    expect(screen.getByTestId("unread")).toHaveTextContent("0")
    expect(fetch).not.toHaveBeenCalled()
  })
})
