// Forms validate with the schemas shared with the API before sending, and show the API's errors by field
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router"
import { describe, expect, it, vi } from "vitest"

import { UserContext } from "@/context/UserContext"
import Login from "@/pages/Login"
import TopicModal from "@/components/content/TopicModal"


// jsdom has no canvas to draw the avatar's PNG with: drawing sets one pixel, serializing gives a 1x1 PNG
vi.mock("@/components/primitives/PixelArtEditor", () => ({
  blankGrid: [[""]],
  serializeGridToBase64png: () => "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  default: ({ gridState: [, setGrid], error }) => (
    <>
      <button type="button" onClick={() => setGrid([["#000"]])}>desenhar</button>
      {error && <span>{error}!</span>}
    </>
  )
}))

const mockFetch = (body = {}, status = 200) => {
  const fetch = vi.fn(async () => ({ ok: status < 400, status, json: async () => body }))
  vi.stubGlobal("fetch", fetch)
  return fetch
}

describe("signing up", () => {
  const renderSignUp = async () => {
    const { container } = render(
      <UserContext.Provider value={{ fetchUser: vi.fn() }}>
        <MemoryRouter><Login /></MemoryRouter>
      </UserContext.Provider>
    )
    await userEvent.click(screen.getByText(/crie uma/))
    const [pass, confirm] = container.querySelectorAll("input[type=password]")

    return {
      name: container.querySelector("input:not([type])"),
      email: container.querySelector("input[type=email]"),
      pass,
      confirm,
      draw: () => userEvent.click(screen.getByText("desenhar")),
      submit: () => userEvent.click(screen.getByRole("button", { name: "cadastrar" }))
    }
  }

  it("refuses what the API would, field by field, without calling it", async () => {
    const fetch = mockFetch()
    const form = await renderSignUp()

    await userEvent.type(form.name, "al@ice")
    await userEvent.type(form.email, "alice@colcom.test")
    await userEvent.type(form.pass, "short")
    await userEvent.type(form.confirm, "short")
    await form.draw()
    await form.submit()

    expect(screen.getByText('não pode conter "@"!')).toBeInTheDocument()
    expect(screen.getByText("mínimo de 8 caracteres!")).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("requires a drawn avatar", async () => {
    const fetch = mockFetch()
    const form = await renderSignUp()

    await userEvent.type(form.name, "alice")
    await userEvent.type(form.email, "alice@colcom.test")
    await userEvent.type(form.pass, "correct horse")
    await userEvent.type(form.confirm, "correct horse")
    await form.submit()

    expect(screen.getByText("a foto de perfil é obrigatória!")).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("requires matching passwords", async () => {
    const fetch = mockFetch()
    const form = await renderSignUp()

    await userEvent.type(form.pass, "correct horse")
    await userEvent.type(form.confirm, "correct horsy")
    await form.submit()

    expect(screen.getByText("senhas não estão iguais!")).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("shows the API's errors next to their fields", async () => {
    const fetch = mockFetch({ name: "ValidationError", key: "name", message: 'O "name" informado já está sendo usado.' }, 400)
    const form = await renderSignUp()

    await userEvent.type(form.name, "alice")
    await userEvent.type(form.email, "alice@colcom.test")
    await userEvent.type(form.pass, "correct horse")
    await userEvent.type(form.confirm, "correct horse")
    await form.draw()
    await form.submit()

    expect(fetch).toHaveBeenCalledOnce()
    expect(await screen.findByText("nome de usuário já utilizado!")).toBeInTheDocument()
  })
})

describe("creating a topic", () => {
  const renderModal = () => {
    const { container } = render(
      <UserContext.Provider value={{ user: { accessToken: "token" } }}>
        <MemoryRouter><TopicModal isOpen setIsOpen={vi.fn()} /></MemoryRouter>
      </UserContext.Provider>
    )
    // The title, then one input per answer
    const textInputs = () => container.querySelectorAll("input:not([type])")
    return {
      title: textInputs()[0],
      enableAnswers: () => userEvent.click(screen.getByLabelText("definir opções de resposta")),
      answer: index => textInputs()[index + 1],
      submit: () => userEvent.click(screen.getByRole("button", { name: "publicar" }))
    }
  }

  it("requires a title", async () => {
    const fetch = mockFetch()
    const form = renderModal()

    await form.submit()

    expect(screen.getByText("campo obrigatório!")).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("refuses a single answer", async () => {
    const fetch = mockFetch()
    const form = renderModal()

    await userEvent.type(form.title, "Should we?")
    await form.enableAnswers()
    await userEvent.type(form.answer(0), "sim")
    await form.submit()

    expect(screen.getByText("respostas: defina ao menos 2 respostas, ou nenhuma")).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("sends trimmed answers, leaving out the empty input", async () => {
    const fetch = mockFetch({ id: 7 }, 201)
    const form = renderModal()

    await userEvent.type(form.title, " Should we? ")
    await form.enableAnswers()
    await userEvent.type(form.answer(0), "sim ")
    await userEvent.type(form.answer(1), "não")
    await form.submit()

    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ title: "Should we?", config: { allowMultipleAnswers: false, answers: ["sim", "não"] } })
  })
})
