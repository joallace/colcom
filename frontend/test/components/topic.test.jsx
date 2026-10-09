// A topic's posts, ranked by votes or grouped by answer
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { beforeEach, describe, expect, it, vi } from "vitest"

import Topic from "@/components/content/Topic"
import { UserContext } from "@/context/UserContext"


// The breakpoints come from SCSS, which jsdom doesn't load
const screenSize = vi.hoisted(() => ({ isDesktop: true }))
vi.mock("@/hooks/useBreakpoint", () => ({ default: () => screenSize.isDesktop }))


const post = (id, title, answer, votes) => ({ id, title, body: `<p>${title}</p>`, votes, upvotes: 0, downvotes: 0, config: { answer } })

const topic = {
  id: 1,
  title: "Tópico",
  config: { answers: ["sim", "não"] },
  // Ranked by votes, as the API sends them, and cropped like the topic list does
  children: [post(10, "Contra", "não", 3), post(11, "A favor", "sim", 1)],
  childrenStats: { count: 4, upvotes: 0, downvotes: 0, votes: 6, critiques: 2, suggestions: 1, answers: { "sim": { count: 3, votes: 3 }, "não": { count: 1, votes: 3 } } },
  userInteractions: [],
  userVote: null
}

const renderTopic = (props = topic) => render(
  <UserContext.Provider value={{ user: null, updatePromoted: () => { } }}>
    <MemoryRouter><Topic {...props} /></MemoryRouter>
  </UserContext.Provider>
)

describe("Topic views", () => {
  beforeEach(() => { screenSize.isDesktop = true })

  it("ranks posts by votes by default", () => {
    renderTopic()

    expect(screen.queryByRole("meter")).toBeNull()
    expect(screen.getByText("1. Contra")).toBeInTheDocument()
    expect(screen.getByText("2. A favor")).toBeInTheDocument()
  })

  it("groups posts by answer, with each answer's share of all votes, and remembers the choice", async () => {
    renderTopic()
    await userEvent.click(screen.getByTitle("agrupar por resposta"))

    const [sim, nao] = screen.getAllByRole("meter")
    expect(sim).toHaveAttribute("aria-label", "sim")
    expect(sim).toHaveAttribute("aria-valuenow", "50")
    expect(nao).toHaveAttribute("aria-label", "não")

    const groups = document.querySelectorAll(".answerGroup")
    expect(groups[0]).toHaveTextContent("3 posts • 50%")
    // A post keeps its number from the vote ranking
    expect(within(groups[0]).getByText("2. A favor")).toBeInTheDocument()
    // 2 of the 3 "sim" posts weren't sent: a link leads to the topic's page
    expect(within(groups[0]).getByText(". . .")).toHaveAttribute("href", "/topics/1")
    expect(groups[1]).toHaveTextContent("1 post • 50%")
    expect(within(groups[1]).queryByText(". . .")).toBeNull()

    expect(localStorage.getItem("topicView")).toBe("answers")
    expect(screen.getByTitle("ordenar por votos")).toBeInTheDocument()
  })

  it("opens in the remembered view, and switches back", async () => {
    localStorage.setItem("topicView", "answers")
    renderTopic()
    expect(screen.getAllByRole("meter")).toHaveLength(2)

    await userEvent.click(screen.getByTitle("ordenar por votos"))
    expect(screen.queryByRole("meter")).toBeNull()
    expect(localStorage.getItem("topicView")).toBe("votes")
  })

  it("switches from the header's menu on phones", async () => {
    screenSize.isDesktop = false
    const { container } = renderTopic()

    await userEvent.click(container.querySelector(".dropdownMenu .clickable"))
    await userEvent.click(screen.getByText("agrupar por resposta"))

    expect(screen.getAllByRole("meter")).toHaveLength(2)
  })

  it("has no grouped view for an open topic", () => {
    localStorage.setItem("topicView", "answers")
    renderTopic({ ...topic, config: { answers: [] }, children: [post(10, "Livre", undefined, 0)] })

    expect(screen.queryByTitle("agrupar por resposta")).toBeNull()
    expect(screen.queryByRole("meter")).toBeNull()
    expect(screen.getByText("1. Livre")).toBeInTheDocument()
  })
})

describe("Topic metrics", () => {
  it("count the interactions with all its posts, and open how many of each", async () => {
    renderTopic({ ...topic, childrenStats: { ...topic.childrenStats, upvotes: 5, downvotes: 2 } })

    await userEvent.click(screen.getByRole("button", { name: "16 interações" }))
    const breakdown = screen.getByRole("dialog", { name: "interações com os posts" })
    expect(within(breakdown).getByText("votos na enquete").nextSibling).toHaveTextContent("6")
    expect(within(breakdown).getByText("marcações de relevante").nextSibling).toHaveTextContent("5")
    expect(within(breakdown).getByText("críticas").nextSibling).toHaveTextContent("2")
  })
})
