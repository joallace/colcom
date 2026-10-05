import { act, render, screen } from "@testing-library/react"
import { MemoryRouter, useNavigate } from "react-router"
import { describe, expect, it } from "vitest"

import usePageParam from "@/hooks/usePageParam"


describe("usePageParam", () => {
  let navigate, setPage

  function ShowPage() {
    const [page, set] = usePageParam()
    navigate = useNavigate()
    setPage = set
    return <span data-testid="page">{page}</span>
  }

  const renderAt = url => render(<MemoryRouter initialEntries={[url]}><ShowPage /></MemoryRouter>)
  const page = () => screen.getByTestId("page").textContent

  it("starts at the first page without `p`", () => {
    renderAt("/recent")
    expect(page()).toBe("0")
  })

  it("counts `p` from 1", () => {
    renderAt("/recent?p=3")
    expect(page()).toBe("2")
  })

  it("can be set without navigating, until the URL asks for another page", async () => {
    renderAt("/recent?p=3")

    act(() => setPage(6))
    expect(page()).toBe("6")

    await act(() => navigate("/recent?p=5"))
    expect(page()).toBe("4")

    await act(() => navigate("/recent"))
    expect(page()).toBe("0")
  })
})
