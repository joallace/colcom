import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"

import Modal from "@/components/primitives/Modal"
import Alert from "@/components/primitives/Alert"
import LoadingButton from "@/components/primitives/LoadingButton"
import Pagination from "@/components/primitives/Pagination"
import PostSummary from "@/components/content/PostSummary"
import { Interactions, PostCount, Promotions, Relevance } from "@/components/content/Metrics"


describe("Modal", () => {
  it("renders nothing while closed", () => {
    const { container } = render(<Modal title="Title">content</Modal>)
    expect(container).toBeEmptyDOMElement()
  })

  it("shows its title and content and closes from the X", async () => {
    const setIsOpen = vi.fn()
    const { container } = render(<Modal isOpen setIsOpen={setIsOpen} title="Crítica">conteúdo</Modal>)

    expect(screen.getByText("Crítica")).toBeInTheDocument()
    expect(screen.getByText("conteúdo")).toBeInTheDocument()

    await userEvent.click(container.querySelector(".header svg"))
    expect(setIsOpen).toHaveBeenCalledWith(false)
  })
})

describe("Alert", () => {
  it("renders nothing without a message", () => {
    const { container } = render(<Alert />)
    expect(container).toBeEmptyDOMElement()
  })

  it("clears its message when dismissed", async () => {
    const setter = vi.fn()
    const { container } = render(<Alert setter={setter}>falhou</Alert>)

    expect(screen.getByText("falhou")).toBeInTheDocument()
    await userEvent.click(container.querySelector("svg"))
    expect(setter).toHaveBeenCalledWith("")
  })
})

describe("LoadingButton", () => {
  it("is disabled while loading", () => {
    render(<LoadingButton isLoading>enviar</LoadingButton>)
    expect(screen.getByRole("button")).toBeDisabled()
    expect(screen.getByRole("button")).toHaveClass("loading")
  })

  it("passes clicks through when idle", async () => {
    const onClick = vi.fn()
    render(<LoadingButton onClick={onClick}>enviar</LoadingButton>)

    await userEvent.click(screen.getByRole("button", { name: "enviar" }))
    expect(onClick).toHaveBeenCalledOnce()
  })
})

describe("Metrics", () => {
  it.each([
    [{ upvotes: 0, downvotes: 0, relevanceVote: "" }, "0 votos"],
    [{ upvotes: 1, downvotes: 0, relevanceVote: "" }, "1 votante achou relevante"],
    [{ upvotes: 0, downvotes: 1, relevanceVote: "" }, "1 votante não achou relevante"],
    [{ upvotes: 3, downvotes: 1, relevanceVote: "" }, "75% dos 4 votantes achou relevante"],
    // The viewer's own vote, not yet counted by the server
    [{ upvotes: 1, downvotes: 0, relevanceVote: "up" }, "100% dos 2 votantes achou relevante"],
    // The viewer removed the vote the server counted
    [{ upvotes: 2, downvotes: 0, relevanceVote: "", initialVoteState: "up" }, "1 votante achou relevante"],
    // The viewer switched from up to down
    [{ upvotes: 1, downvotes: 1, relevanceVote: "down", initialVoteState: "up" }, "0% dos 2 votantes achou relevante"],
  ])("Relevance %o reads %j", (props, expected) => {
    const { container } = render(<Relevance {...props} />)
    expect(container.textContent.replace(/\s+/g, " ").trim()).toBe(expected)
  })

  it.each([
    [{ promotionCount: 1, userIsPromoting: false, topicId: 7, userPromotingTopicId: null }, "promovido por 1 usuário"],
    [{ promotionCount: 2, userIsPromoting: false, topicId: 7, userPromotingTopicId: 8 }, "promovido por 2 usuários"],
    // Promoting now, not yet counted by the server
    [{ promotionCount: 0, userIsPromoting: false, topicId: 7, userPromotingTopicId: 7 }, "promovido por 1 usuário"],
    // Was promoting it when loaded, moved to another topic since
    [{ promotionCount: 1, userIsPromoting: true, topicId: 7, userPromotingTopicId: 8 }, "promovido por 0 usuários"],
  ])("Promotions %o reads %j", (props, expected) => {
    const { container } = render(<Promotions {...props} />)
    expect(container.textContent.replace(/\s+/g, " ").trim()).toBe(expected)
  })

  it("pluralizes counts", () => {
    expect(render(<PostCount count={1} />).container.textContent).toBe("1 post")
    expect(render(<PostCount count={2} />).container.textContent).toBe("2 posts")
    expect(render(<Interactions count={1} />).container.textContent).toBe("1 interação")
    expect(render(<Interactions count={0} />).container.textContent).toBe("0 interações")
  })
})

describe("PostSummary", () => {
  const renderSummary = props => render(<MemoryRouter><PostSummary parent_id={1} id={2} percentage={0.5} {...props} /></MemoryRouter>)

  it("links to the post and shows its answer and share of the votes", () => {
    renderSummary({ summary: "Resumo", shortAnswer: "sim" })

    expect(screen.getByRole("link")).toHaveAttribute("href", "/topics/1/posts/2")
    expect(screen.getByText("sim")).toBeInTheDocument()
    expect(screen.getByText("50%")).toBeInTheDocument()
    expect(screen.getByText("Resumo")).toBeInTheDocument()
  })

  it("sanitizes the summary", () => {
    const { container } = renderSummary({ summary: '<strong>ok</strong><img src=x onerror="alert(1)"><script>alert(2)</script>', shortAnswer: "sim" })

    expect(container.querySelector("strong")).toHaveTextContent("ok")
    expect(container.querySelector("img")).not.toHaveAttribute("onerror")
    expect(container.querySelector("script")).toBeNull()
  })

  it("numbers a post without an answer by its position", () => {
    renderSummary({ summary: "Resumo", index: 2 })
    expect(screen.getByText("3.")).toBeInTheDocument()
  })
})

describe("Pagination", () => {
  const renderPagination = ({ index = 0, maxIndex = 9, setIndex = vi.fn() } = {}) => {
    render(<MemoryRouter><Pagination path="/recent" state={[index, setIndex]} maxIndex={maxIndex} /></MemoryRouter>)
    return setIndex
  }
  const pages = () => screen.getAllByRole("link").filter(link => /^\d+$/.test(link.textContent))

  it("renders nothing for a single page", () => {
    render(<MemoryRouter><Pagination state={[0, vi.fn()]} maxIndex={0} /></MemoryRouter>)
    expect(screen.queryByRole("link")).toBeNull()
  })

  it("shows at most 5 pages around the current one", () => {
    renderPagination({ index: 5 })
    expect(pages().map(link => link.textContent)).toEqual(["4", "5", "6", "7", "8"])
    expect(pages()[2]).toHaveClass("active")
  })

  it("shows the last pages at the end", () => {
    renderPagination({ index: 9 })
    expect(pages().map(link => link.textContent)).toEqual(["6", "7", "8", "9", "10"])
  })

  it("links each page to its address", () => {
    renderPagination({ index: 0 })
    expect(pages().map(link => link.getAttribute("href"))).toEqual(["/recent", "/recent?p=2", "/recent?p=3", "/recent?p=4", "/recent?p=5"])
  })

  it("moves to a clicked page", async () => {
    const setIndex = renderPagination({ index: 0 })
    await userEvent.click(screen.getByText("3"))
    expect(setIndex).toHaveBeenCalledWith(2)
  })

  it("only shows existing pages when there are fewer than 5", () => {
    renderPagination({ index: 0, maxIndex: 2 })
    expect(pages().map(link => link.textContent)).toEqual(["1", "2", "3"])
  })
})
