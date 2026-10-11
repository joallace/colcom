// The appearance page with the real ThemeProvider: previews, saving on the account or in the browser
import React from "react"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router"
import { describe, expect, it, vi } from "vitest"

import Settings from "@/pages/Settings"
import ThemeProvider from "@/context/ThemeProvider"
import { UserContext } from "@/context/UserContext"
import { PRESETS, THEME_KEY } from "@/assets/themes"
import { storeToken } from "../support/session"


const API = "http://api.test"
const root = document.documentElement

function mockApi(status = 200) {
  const fetch = vi.fn(async (url, options) => status === 200 ?
    { ok: true, status, json: async () => ({ theme: JSON.parse(options.body).theme }) }
    :
    { ok: false, status, json: async () => ({ message: "Tema: tema inválido." }) })
  vi.stubGlobal("fetch", fetch)
  return fetch
}

// Holds the user as UserProvider does, so saving updates it
function Providers({ initialUser, children }) {
  const [user, setUser] = React.useState(initialUser)
  const updateTheme = theme => setUser(prev => prev && { ...prev, theme })
  return (
    <UserContext.Provider value={{ user, updateTheme }}>
      <ThemeProvider>{children}</ThemeProvider>
    </UserContext.Provider>
  )
}

function renderPage(user = null) {
  storeToken(user)
  return render(
    <Providers initialUser={user}>
      <MemoryRouter initialEntries={["/settings"]}>
        <Routes>
          <Route path="/settings" element={<Settings />} />
          <Route path="/" element={<p>início</p>} />
        </Routes>
      </MemoryRouter>
    </Providers>
  )
}

const preset = name => screen.getByRole("radio", { name: new RegExp(name) })
const cleanRoot = () => {
  root.removeAttribute("style")
  delete root.dataset.scheme
}

describe("Settings", () => {
  it("previews a preset on the whole page without saving it, and discards it", async () => {
    cleanRoot()
    const fetch = mockApi()
    renderPage({ name: "alice", accessToken: "token-1", theme: null })

    await userEvent.click(preset("claro"))
    expect(root.style.getPropertyValue("--bg")).toBe(PRESETS.claro.colors.bg)
    expect(root.dataset.scheme).toBe("light")
    expect(fetch).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole("button", { name: "descartar" }))
    expect(root.style.getPropertyValue("--bg")).toBe("")
    expect(preset("colcom")).toBeChecked()
  })

  it("saves the theme on the account and caches it for the next visit", async () => {
    cleanRoot()
    const fetch = mockApi()
    renderPage({ name: "alice", accessToken: "token-1", theme: null })

    await userEvent.click(preset("alto contraste"))
    await userEvent.click(screen.getByRole("button", { name: "salvar" }))

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    const [url, options] = fetch.mock.calls[0]
    expect(url).toBe(`${API}/users/self`)
    expect(options.method).toBe("PATCH")
    expect(JSON.parse(options.body)).toEqual({ theme: { preset: "contraste" } })
    expect(JSON.parse(localStorage.getItem(THEME_KEY)).theme).toEqual({ preset: "contraste" })
    expect(screen.getByRole("button", { name: "salvar" })).toBeDisabled()
    expect(root.style.getPropertyValue("--bg")).toBe(PRESETS.contraste.colors.bg)
  })

  it("shows the account's theme over the browser's", () => {
    cleanRoot()
    localStorage.setItem(THEME_KEY, JSON.stringify({ theme: { preset: "claro" } }))
    renderPage({ name: "alice", accessToken: "token-1", theme: { preset: "contraste" } })

    expect(preset("alto contraste")).toBeChecked()
    expect(root.style.getPropertyValue("--bg")).toBe(PRESETS.contraste.colors.bg)
  })

  it("keeps a visitor's theme in the browser, without asking the API", async () => {
    cleanRoot()
    const fetch = mockApi()
    renderPage(null)

    expect(screen.getByText(/salvo neste navegador/)).toBeInTheDocument()
    await userEvent.click(preset("claro"))
    await userEvent.click(screen.getByRole("button", { name: "salvar" }))

    expect(fetch).not.toHaveBeenCalled()
    expect(JSON.parse(localStorage.getItem(THEME_KEY))).toMatchObject({ theme: { preset: "claro" }, scheme: "light" })
  })

  it("warns about colors that are hard to read, and stores only the changed ones", async () => {
    cleanRoot()
    const fetch = mockApi()
    renderPage({ name: "alice", accessToken: "token-1", theme: null })

    fireEvent.input(screen.getByLabelText("texto discreto"), { target: { value: "#2a1a0a" } })
    expect(screen.getByRole("status")).toHaveTextContent("texto discreto sobre fundo")
    expect(root.style.getPropertyValue("--text-muted")).toBe("#2a1a0a")

    await userEvent.click(screen.getByRole("button", { name: "salvar" }))
    await waitFor(() => expect(fetch).toHaveBeenCalledOnce())
    expect(JSON.parse(fetch.mock.calls[0][1].body)).toEqual({ theme: { preset: "colcom", colors: { "text-muted": "#2a1a0a" } } })

    await userEvent.click(screen.getByRole("button", { name: "restaurar texto discreto" }))
    expect(screen.queryByRole("status")).not.toBeInTheDocument()
  })

  it("names the colors by what they paint, each fill beside its text, and lets every chart series change", async () => {
    cleanRoot()
    mockApi()
    renderPage(null)

    expect(screen.getByText("primária")).toBeInTheDocument()
    expect(screen.getByLabelText("cor primária")).toHaveValue(PRESETS.colcom.colors.primary)
    expect(screen.getByLabelText("texto primário")).toHaveValue(PRESETS.colcom.colors["primary-text"])
    expect(screen.getByText(/títulos, página atual/)).toBeInTheDocument()

    fireEvent.input(screen.getByLabelText("série 6 dos gráficos"), { target: { value: "#123456" } })
    expect(root.style.getPropertyValue("--chart-6")).toBe("#123456")

    await userEvent.click(screen.getByRole("button", { name: "salvar" }))
    expect(JSON.parse(localStorage.getItem(THEME_KEY)).theme).toEqual({ preset: "colcom", colors: { "chart-6": "#123456" } })
  })

  it("shows the API's refusal and keeps the account's theme", async () => {
    cleanRoot()
    mockApi(400)
    renderPage({ name: "alice", accessToken: "token-1", theme: null })

    await userEvent.click(preset("claro"))
    await userEvent.click(screen.getByRole("button", { name: "salvar" }))

    expect(await screen.findByText("Tema: tema inválido.")).toBeInTheDocument()
    // Still previewed, so it can be saved again
    expect(screen.getByRole("button", { name: "salvar" })).toBeEnabled()
  })
})
