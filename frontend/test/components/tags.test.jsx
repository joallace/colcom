// Tags under a topic: pills, the curation panel and the field that picks a tag
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"

import TagList from "@/components/content/TagList"
import TagInput from "@/components/content/TagInput"
import TopicModal from "@/components/content/TopicModal"
import { UserContext } from "@/context/UserContext"


const API = "http://api.test"

const tag = (slug, overrides = {}) => ({ slug, name: slug, provisional: false, visible: true, endorsements: 1, contests: 0, ...overrides })

// GET /tags answers with `found`; POST /topics/:id/tags with `onVote(body)`
function mockApi({ found = [], onVote = () => ({ tags: [] }) } = {}) {
  const fetch = vi.fn(async (url, options = {}) => {
    const { pathname } = new URL(url)
    if (pathname === "/tags")
      return { ok: true, status: 200, json: async () => ({ tags: found, count: found.length }) }
    if (/^\/topics\/\d+\/tags$/.test(pathname) && options.method === "post") {
      const result = onVote(JSON.parse(options.body))
      return { ok: !result.message, status: result.message ? 403 : 200, json: async () => result }
    }
    return { ok: false, status: 404, json: async () => ({}) }
  })
  vi.stubGlobal("fetch", fetch)
  return fetch
}

const renderWithUser = (ui, user = { accessToken: "token" }) => render(
  <UserContext.Provider value={{ user }}>
    <MemoryRouter>{ui}</MemoryRouter>
  </UserContext.Provider>
)

describe("a topic's tags", () => {
  it("shows the visible ones as links to their pages, styled by status and by the viewer's vote", () => {
    renderWithUser(<TagList topicId={1} tags={[
      tag("politica", { name: "Política", userVote: 1 }),
      tag("texas", { provisional: true, userVote: -1 }),
      tag("spam", { visible: false, contests: 3 })
    ]} />)

    const pills = within(screen.getByRole("list", { name: "tags do tópico" })).getAllByRole("link")
    expect(pills.map(pill => pill.textContent)).toEqual(["Política", "texas"])
    expect(pills[0]).toHaveAttribute("href", "/t/politica")
    expect(pills[0]).toHaveClass("tagPill", "endorsed")
    expect(pills[1]).toHaveClass("provisional", "contested")
    expect(pills[1]).toHaveAttribute("title", "texas (tag nova, provisória)")
  })

  it("collapses tags past the first five into +N", async () => {
    renderWithUser(<TagList topicId={1} tags={["a1", "a2", "a3", "a4", "a5", "a6", "a7"].map(slug => tag(slug))} />)

    expect(screen.getAllByRole("link")).toHaveLength(5)
    await userEvent.click(screen.getByRole("button", { name: "mostrar mais 2 tags" }))
    expect(screen.getAllByRole("link")).toHaveLength(7)
  })

  it("offers to add tags when there are none", () => {
    renderWithUser(<TagList topicId={1} />)
    expect(screen.queryByRole("list")).toBeNull()
    expect(screen.getByRole("button", { name: "tags do tópico: votar e propor" })).toHaveTextContent("adicionar tags")
  })

  it("endorses, contests and withdraws from the curation panel", async () => {
    const votes = []
    const fetch = mockApi({
      onVote: body => {
        votes.push(body)
        return { tags: [tag("politica", { userVote: body.value || null, endorsements: body.value === 1 ? 2 : 1, contests: body.value === -1 ? 1 : 0 })] }
      }
    })
    renderWithUser(<TagList topicId={4} tags={[tag("politica")]} />)

    await userEvent.click(screen.getByRole("button", { name: "tags do tópico: votar e propor" }))
    const panel = screen.getByRole("dialog", { name: "tags do tópico" })
    expect(panel).toHaveTextContent("pelo menos tantos apoios quanto contestações")
    expect(panel).toHaveTextContent("1 apoio · 0 contestações")

    await userEvent.click(within(panel).getByRole("button", { name: "apoiar politica" }))
    expect(await within(panel).findByText(/2 apoios/)).toBeInTheDocument()
    expect(within(panel).getByRole("button", { name: "apoiar politica" })).toHaveAttribute("aria-pressed", "true")

    // Pressing the active vote withdraws it
    await userEvent.click(within(panel).getByRole("button", { name: "apoiar politica" }))
    await userEvent.click(within(panel).getByRole("button", { name: "contestar politica" }))

    expect(votes).toEqual([{ tag: "politica", value: 1 }, { tag: "politica", value: 0 }, { tag: "politica", value: -1 }])
    expect(fetch).toHaveBeenCalledWith(`${API}/topics/4/tags`, expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer token" }) }))
    // The pill under the title follows
    expect(screen.getAllByRole("link", { name: "politica" })[0]).toHaveClass("contested")
  })

  it("proposes a tag and shows why the API refused one", async () => {
    mockApi({
      onVote: body => body.tag === "Nova" ? { message: "Contas com menos de 7 dias não podem criar tags." } : { tags: [tag("politica"), tag(body.tag.toLowerCase(), { userVote: 1 })] }
    })
    renderWithUser(<TagList topicId={4} tags={[tag("politica")]} />)
    await userEvent.click(screen.getByRole("button", { name: "tags do tópico: votar e propor" }))

    await userEvent.type(screen.getByRole("combobox", { name: "propor uma tag" }), "Nova{Enter}")
    expect(await screen.findByRole("alert")).toHaveTextContent("menos de 7 dias")

    await userEvent.type(screen.getByRole("combobox", { name: "propor uma tag" }), "Texas{Enter}")
    expect(await screen.findByText("texas", { selector: ".tagList a" })).toBeInTheDocument()
    expect(screen.queryByRole("alert")).toBeNull()
  })

  it("asks to log in to vote", async () => {
    mockApi()
    renderWithUser(<TagList topicId={4} tags={[tag("politica")]} />, null)
    await userEvent.click(screen.getByRole("button", { name: "tags do tópico: votar e propor" }))

    expect(screen.getByRole("button", { name: "entre para votar nas tags" })).toBeInTheDocument()
    expect(screen.queryByRole("combobox")).toBeNull()
  })
})

describe("the tag field", () => {
  it("suggests existing tags and offers to create the typed one", async () => {
    const fetch = mockApi({ found: [{ slug: "politica-publica", name: "Política Pública", topics: 3 }, { slug: "politica", name: "Política", topics: 1 }] })
    const onPick = vi.fn()
    renderWithUser(<TagInput onPick={onPick} exclude={["politica"]} />)

    await userEvent.type(screen.getByRole("combobox"), "Polít")
    // The one already chosen isn't offered
    await waitFor(() => expect(screen.getAllByRole("option").map(option => option.textContent)).toEqual(["Política Pública3 tópicos", 'criar "Polít"polit']))
    expect(fetch).toHaveBeenLastCalledWith(`${API}/tags?q=polit&pageSize=6`, expect.anything())

    await userEvent.keyboard("{ArrowDown}{Enter}")
    expect(onPick).toHaveBeenCalledWith("Política Pública")
    expect(screen.getByRole("combobox")).toHaveValue("")
  })

  it("refuses names the API would", async () => {
    mockApi()
    const onPick = vi.fn()
    renderWithUser(<TagInput onPick={onPick} />)

    await userEvent.type(screen.getByRole("combobox"), "c++{Enter}")
    expect(onPick).not.toHaveBeenCalled()
    expect(screen.getByText("use letras, números, espaços ou hífens!")).toBeInTheDocument()
  })
})

describe("a new topic's tags", () => {
  it("are sent with the topic, and can be removed before", async () => {
    const fetch = mockApi()
    const { container } = renderWithUser(<TopicModal isOpen setIsOpen={vi.fn()} />)

    await userEvent.type(container.querySelector("input:not([type])"), "Should we?")
    const field = screen.getByRole("combobox", { name: "tags (opcional)" })
    await userEvent.type(field, "Política{Enter}")
    await userEvent.type(field, "Texas{Enter}")
    await userEvent.type(field, "POLITICA{Enter}")
    expect(screen.getByText("tag já adicionada!")).toBeInTheDocument()
    await userEvent.clear(field)
    await userEvent.click(screen.getByRole("button", { name: "remover Texas" }))

    fetch.mockClear()
    await userEvent.click(screen.getByRole("button", { name: "publicar" }))
    expect(JSON.parse(fetch.mock.calls[0][1].body).tags).toEqual(["Política"])
  })
})
