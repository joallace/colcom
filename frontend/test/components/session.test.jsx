// Logging in, the logged in user and voting: the components that talk to the API
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import { MemoryRouter, Route, Routes } from "react-router"
import { describe, expect, it, vi } from "vitest"

import useUser, { UserContext } from "@/context/UserContext"
import UserProvider from "@/context/UserProvider"
import Login from "@/pages/Login"
import VotingButtons from "@/components/primitives/VotingButtons"
import { submitVote } from "@/assets/interactions"


const API = "http://api.test"

// Answers fetch with `body` and `status`, recording the calls
const mockFetch = (body = {}, status = 200) => {
  const fetch = vi.fn(async () => ({ ok: status < 400, status, json: async () => body }))
  vi.stubGlobal("fetch", fetch)
  return fetch
}

describe("UserProvider", () => {
  function ShowUser() {
    const { user, clearUser } = useUser()
    return (
      <>
        <span data-testid="user">{user === undefined ? "loading" : JSON.stringify(user)}</span>
        <button onClick={clearUser}>sair</button>
      </>
    )
  }

  it("has no user without a stored token, and doesn't ask the API", async () => {
    const fetch = mockFetch()
    render(<UserProvider><ShowUser /></UserProvider>)

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("null"))
    expect(fetch).not.toHaveBeenCalled()
  })

  it("loads the user of the stored token", async () => {
    localStorage.setItem("accessToken", "token-123")
    const fetch = mockFetch({ name: "alice", pid: "p1" })
    render(<UserProvider><ShowUser /></UserProvider>)

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent('{"name":"alice","pid":"p1","accessToken":"token-123"}'))
    expect(fetch).toHaveBeenCalledWith(`${API}/users/self`, { method: "get", headers: { Authorization: "Bearer token-123" } })
  })

  it("forgets a token the API refuses", async () => {
    localStorage.setItem("accessToken", "expired")
    mockFetch({ message: "Token inválido" }, 401)
    render(<UserProvider><ShowUser /></UserProvider>)

    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("null"))
    expect(localStorage.getItem("accessToken")).toBeNull()
  })

  it("logs out", async () => {
    localStorage.setItem("accessToken", "token-123")
    mockFetch({ name: "alice" })
    render(<UserProvider><ShowUser /></UserProvider>)
    await waitFor(() => expect(screen.getByTestId("user")).toHaveTextContent("alice"))

    await userEvent.click(screen.getByText("sair"))

    expect(screen.getByTestId("user")).toHaveTextContent("null")
    expect(localStorage.getItem("accessToken")).toBeNull()
  })
})

describe("Login", () => {
  const renderLogin = () => {
    const fetchUser = vi.fn()
    const { container } = render(
      <UserContext.Provider value={{ fetchUser }}>
        <MemoryRouter initialEntries={["/login"]}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<span>home</span>} />
          </Routes>
        </MemoryRouter>
      </UserContext.Provider>
    )
    return {
      fetchUser,
      login: container.querySelector("input:not([type])"),
      pass: container.querySelector("input[type=password]"),
      submit: () => userEvent.click(screen.getByRole("button", { name: "entrar" }))
    }
  }

  it("logs in, stores the token and goes home", async () => {
    const fetch = mockFetch({ accessToken: "new-token" })
    const { fetchUser, login, pass, submit } = renderLogin()

    await userEvent.type(login, "alice")
    await userEvent.type(pass, "secret")
    await submit()

    await waitFor(() => expect(screen.getByText("home")).toBeInTheDocument())
    expect(fetch).toHaveBeenCalledWith(`${API}/login`, expect.objectContaining({ method: "post", body: JSON.stringify({ login: "alice", pass: "secret" }) }))
    expect(localStorage.getItem("accessToken")).toBe("new-token")
    expect(fetchUser).toHaveBeenCalled()
  })

  it("requires both fields before calling the API", async () => {
    const fetch = mockFetch()
    const { login, submit } = renderLogin()

    await userEvent.type(login, "alice")
    await submit()

    expect(screen.getByText("campo obrigatório!")).toBeInTheDocument()
    expect(fetch).not.toHaveBeenCalled()
  })

  it("shows the API's error", async () => {
    mockFetch({ name: "ValidationError", message: "Combinação de login e senha inválida." }, 400)
    const { login, pass, submit } = renderLogin()

    await userEvent.type(login, "alice")
    await userEvent.type(pass, "wrong")
    await submit()

    expect(await screen.findByText("combinação de login e senha inválida.")).toBeInTheDocument()
    expect(localStorage.getItem("accessToken")).toBeNull()
  })

  it("tells the user when the API can't be reached", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch") }))
    vi.spyOn(console, "error").mockImplementation(() => { })
    const { login, pass, submit } = renderLogin()

    await userEvent.type(login, "alice")
    await userEvent.type(pass, "secret")
    await submit()

    expect(await screen.findByText(/Não foi possível se conectar ao colcom/)).toBeInTheDocument()
  })

  it("switches to sign up", async () => {
    renderLogin()
    await userEvent.click(screen.getByText(/crie uma/))

    expect(screen.getByRole("button", { name: "cadastrar" })).toBeInTheDocument()
    expect(screen.getByText("foto de perfil")).toBeInTheDocument()
  })
})

describe("submitVote", () => {
  it("sends logged out users to the login page", async () => {
    const fetch = mockFetch()
    const navigate = vi.fn()

    await submitVote(navigate, 5, "up")

    expect(navigate).toHaveBeenCalledWith("/login")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("posts the interaction with the user's token", async () => {
    localStorage.setItem("accessToken", "token-123")
    const fetch = mockFetch({}, 201)

    await submitVote(vi.fn(), 5, "vote")

    expect(fetch).toHaveBeenCalledWith(`${API}/interactions`, {
      method: "post",
      headers: { "Content-Type": "application/json", Authorization: "Bearer token-123" },
      body: JSON.stringify({ content_id: 5, type: "vote" })
    })
  })
})

describe("VotingButtons", () => {
  function Voting({ initial = "", definitive = null, type = "vote" }) {
    const [relevanceVote, setRelevanceVote] = React.useState(initial)
    const [definitiveVote, setDefinitiveVote] = React.useState(definitive)
    return (
      <MemoryRouter>
        <VotingButtons
          id={5}
          relevanceVote={relevanceVote}
          setRelevanceVote={setRelevanceVote}
          definitiveVote={definitiveVote}
          setDefinitiveVote={setDefinitiveVote}
          definitiveVoteType={type}
          showDefinitiveVoteButton
        />
        <span data-testid="state">{`${relevanceVote}|${definitiveVote}`}</span>
      </MemoryRouter>
    )
  }

  const sentTypes = fetch => fetch.mock.calls.map(([, options]) => JSON.parse(options.body).type)

  it("toggles relevance votes and tells the API", async () => {
    localStorage.setItem("accessToken", "t")
    const fetch = mockFetch({}, 201)
    const { container } = render(<Voting />)

    await userEvent.click(container.querySelector(".up"))
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("up|"))
    await userEvent.click(container.querySelector(".down"))
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("down|"))
    await userEvent.click(container.querySelector(".down"))
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent(/^\|/))

    expect(sentTypes(fetch)).toEqual(["up", "down", "down"])
  })

  it("votes in the poll", async () => {
    localStorage.setItem("accessToken", "t")
    const fetch = mockFetch({}, 201)
    render(<Voting definitive={false} />)

    await userEvent.click(screen.getByRole("radio"))

    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("|true"))
    expect(sentTypes(fetch)).toEqual(["vote"])
  })

  it("promotes a topic, or stops promoting it", async () => {
    localStorage.setItem("accessToken", "t")
    mockFetch({}, 201)
    render(<Voting type="promote" />)

    await userEvent.click(screen.getByRole("radio"))
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("|5"))
    await userEvent.click(screen.getByRole("radio"))
    await waitFor(() => expect(screen.getByTestId("state")).toHaveTextContent("|null"))
  })
})
