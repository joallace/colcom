// The navigation drawer of narrow screens (tests see no breakpoints, so always a narrow screen)
import { fireEvent, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from "react-router"
import { describe, expect, it } from "vitest"

import Sidebar from "@/components/layout/Sidebar"
import { NAV_LINKS } from "@/assets/navigation"


function Where() {
  const { pathname } = useLocation()
  return <p>at {pathname}</p>
}

function GoBack() {
  const navigate = useNavigate()
  return <button onClick={() => navigate(-1)}>voltar</button>
}

const renderSidebar = (path = "/recent") => render(
  <MemoryRouter initialEntries={["/promoted", path]} initialIndex={1}>
    <Sidebar />
    <GoBack />
    <Routes>
      <Route path="*" element={<Where />} />
    </Routes>
  </MemoryRouter>
)

const open = async user => {
  await user.click(screen.getByRole("button", { name: "menu" }))
  return screen.getByRole("dialog", { name: "navegação" })
}

describe("Sidebar", () => {
  it("opens a drawer with every section, marking the current one", async () => {
    const user = userEvent.setup()
    renderSidebar("/recent")

    const toggle = screen.getByRole("button", { name: "menu" })
    expect(toggle).toHaveAttribute("aria-expanded", "false")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    const drawer = within(await open(user))
    expect(toggle).toHaveAttribute("aria-expanded", "true")
    for (const { to, label } of NAV_LINKS)
      expect(drawer.getByRole("link", { name: label })).toHaveAttribute("href", to)
    expect(drawer.getByRole("link", { name: "recentes" })).toHaveAttribute("aria-current", "page")
    expect(drawer.getByRole("link", { name: "promovidos" })).not.toHaveAttribute("aria-current")
    expect(drawer.getByRole("link", { name: "buscar" })).toHaveAttribute("href", "/search")
    expect(drawer.getByRole("link", { name: "aparência" })).toHaveAttribute("href", "/settings")
  })

  it("closes on following a link", async () => {
    const user = userEvent.setup()
    renderSidebar()

    await user.click(within(await open(user)).getByRole("link", { name: "pódio" }))

    expect(screen.getByText("at /podium")).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("closes with its button, Escape and a click on the backdrop", async () => {
    const user = userEvent.setup()
    renderSidebar()

    await user.click(within(await open(user)).getByRole("button", { name: "fechar" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    fireEvent(await open(user), new Event("cancel", { cancelable: true }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    // A click on the panel is not one on the backdrop
    const drawer = await open(user)
    await user.click(drawer.querySelector(".sidebarPanel"))
    expect(screen.getByRole("dialog")).toBeInTheDocument()
    await user.click(drawer)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("closes when the address changes some other way", async () => {
    const user = userEvent.setup()
    renderSidebar()
    await open(user)

    // Behind the modal in a browser; here only to change the address
    fireEvent.click(screen.getByText("voltar"))

    expect(screen.getByText("at /promoted")).toBeInTheDocument()
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })
})
