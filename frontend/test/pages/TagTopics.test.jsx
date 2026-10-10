// A tag page (/t/a+b) against a mocked API: the topics having all the tags, and the tags to widen or
// narrow the set
import { render, screen, within } from "@testing-library/react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { describe, expect, it, vi } from "vitest"

import TagTopics from "@/pages/TagTopics"
import { UserContext } from "@/context/UserContext"


vi.mock("@/hooks/useBreakpoint", () => ({ default: () => true }))

const topic = (id, title, tags) => ({
  id, title, config: { answers: [] }, children: [], upvotes: 0, downvotes: 0, promotions: 0, userInteractions: [], userVote: null,
  childrenStats: { count: 0, upvotes: 0, downvotes: 0, votes: 0, critiques: 0, suggestions: 0, answers: {} },
  tags: tags.map(slug => ({ slug, name: slug, provisional: false, visible: true, endorsements: 1, contests: 0 }))
})

const INFO = {
  "politica": { tags: [{ slug: "politica", name: "Política", provisional: false }], canonical: "politica", topics: 2, related: [{ slug: "eua", name: "EUA", provisional: false, topics: 1 }] },
  "politica,eua": { tags: [{ slug: "politica", name: "Política", provisional: false }, { slug: "eua", name: "EUA", provisional: false }], canonical: "politica,eua", topics: 1, related: [] },
  "eleicao": { tags: [{ slug: "eleicoes", name: "Eleições", provisional: false }], canonical: "eleicoes", topics: 0, related: [] }
}

function mockApi() {
  const fetch = vi.fn(async url => {
    const { pathname, searchParams } = new URL(url)
    const info = INFO[decodeURIComponent(pathname.replace(/^\/tags\//, ""))]
    if (pathname.startsWith("/tags/"))
      return info ? { ok: true, status: 200, json: async () => info } : { ok: false, status: 404, json: async () => ({ message: "Tag não encontrada." }) }
    if (pathname === "/topics") {
      const tree = searchParams.get("tags") === "politica,eua" ? [topic(1, "No Texas?", ["politica", "eua"])] : [topic(1, "No Texas?", ["politica", "eua"]), topic(2, "Reforma", ["politica"])]
      return { ok: true, status: 200, json: async () => ({ tree, count: tree.length }) }
    }
    return { ok: false, status: 404, json: async () => ({}) }
  })
  vi.stubGlobal("fetch", fetch)
  return fetch
}

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>
}

const renderAt = path => render(
  <UserContext.Provider value={{ user: null, updatePromoted: () => { } }}>
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/t/:tags" element={<><TagTopics /><Where /></>} />
        <Route path="*" element={<Where />} />
      </Routes>
    </MemoryRouter>
  </UserContext.Provider>
)

describe("tag pages", () => {
  it("list the topics having the tag, with tags that narrow the set", async () => {
    const fetch = mockApi()
    renderAt("/t/politica")

    expect(await screen.findByText("Reforma")).toBeInTheDocument()
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("/topics?page=1&pageSize=10&tags=politica&orderBy=id&with_count"), expect.anything())

    // Topic titles are headings too
    const heading = screen.getByRole("heading", { name: /remover/ })
    expect(within(heading).getByRole("link")).toHaveAttribute("href", "/recent")
    expect(await screen.findByText("2 tópicos")).toBeInTheDocument()
    const narrow = within(screen.getByRole("group", { name: "refinar com outra tag" })).getByRole("link")
    expect(narrow).toHaveAttribute("href", "/t/politica+eua")
    expect(document.title).toBe("Política · colcom")
  })

  it("combine tags, each one removable", async () => {
    const fetch = mockApi()
    renderAt("/t/politica+eua")

    expect(await screen.findByText("No Texas?")).toBeInTheDocument()
    expect(screen.queryByText("Reforma")).toBeNull()
    expect(fetch).toHaveBeenCalledWith(expect.stringContaining("&tags=politica,eua&"), expect.anything())

    const heading = await screen.findByRole("heading", { name: /remover/ })
    expect(within(heading).getAllByRole("link").map(link => link.getAttribute("href"))).toEqual(["/t/eua", "/t/politica"])
    expect(screen.getByText("1 tópico")).toBeInTheDocument()
  })

  it("go to the tag a merged one became", async () => {
    mockApi()
    renderAt("/t/eleicao")
    expect(await screen.findByText("/t/eleicoes")).toBeInTheDocument()
  })

  it("say when a tag doesn't exist", async () => {
    mockApi()
    renderAt("/t/nada")
    expect(await screen.findByText("tag não encontrada.")).toBeInTheDocument()
  })
})
