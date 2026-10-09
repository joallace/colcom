import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"

import Popover from "@/components/primitives/Popover"


describe("Popover", () => {
  it("opens from its trigger as a dialog named by its heading, and closes from it again", async () => {
    render(<Popover heading="Detalhes" content={<p>conteúdo</p>}>abrir</Popover>)
    const trigger = screen.getByRole("button", { name: "abrir" })

    expect(screen.queryByText("conteúdo")).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute("aria-expanded", "false")

    await userEvent.click(trigger)
    expect(screen.getByRole("dialog", { name: "Detalhes" })).toHaveTextContent("conteúdo")
    expect(trigger).toHaveAttribute("aria-expanded", "true")

    await userEvent.click(trigger)
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("closes on Escape and on a click outside", async () => {
    render(
      <>
        <Popover content="conteúdo">abrir</Popover>
        <p>fora</p>
      </>
    )

    await userEvent.click(screen.getByRole("button", { name: "abrir" }))
    await userEvent.keyboard("{Escape}")
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "abrir" }))
    await userEvent.click(screen.getByText("fora"))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("gives a content function a way to close it", async () => {
    render(<Popover content={({ close }) => <button onClick={close}>fechar</button>}>abrir</Popover>)

    await userEvent.click(screen.getByRole("button", { name: "abrir" }))
    await userEvent.click(await screen.findByRole("button", { name: "fechar" }))
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
  })

  it("passes other props to its trigger, keeping its handlers", async () => {
    const onClick = vi.fn()
    render(<Popover content="conteúdo" className="bell" aria-label="sino" onClick={onClick}>🔔</Popover>)
    const trigger = screen.getByRole("button", { name: "sino" })

    expect(trigger).toHaveClass("popoverTrigger", "bell")
    await userEvent.click(trigger)
    expect(onClick).toHaveBeenCalled()
    expect(screen.getByRole("dialog")).toBeInTheDocument()
  })

  it("can be controlled", async () => {
    const onOpenChange = vi.fn()
    const { rerender } = render(<Popover open={false} onOpenChange={onOpenChange} content="conteúdo">abrir</Popover>)

    await userEvent.click(screen.getByRole("button", { name: "abrir" }))
    expect(onOpenChange).toHaveBeenCalledWith(true, expect.anything(), expect.anything())
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument()

    rerender(<Popover open onOpenChange={onOpenChange} content="conteúdo">abrir</Popover>)
    await waitFor(() => expect(screen.getByRole("dialog")).toHaveTextContent("conteúdo"))
  })
})
