// Logging in, the logged in user and voting: the components that talk to the API
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import React from "react"
import { MemoryRouter, Route, Routes, useLocation } from "react-router"
import { describe, expect, it, vi } from "vitest"

import useUser, { UserContext } from "@/context/UserContext"
import UserProvider from "@/context/UserProvider"
import Login from "@/pages/Login"
import VotingButtons from "@/components/primitives/VotingButtons"
import { submitVote } from "@/assets/interactions"
import useToLogin from "@/hooks/useToLogin"


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
  function Where() {
    const { pathname, search, hash, state } = useLocation()
    return <span data-testid="where">{`${pathname}${search}${hash} ${JSON.stringify(state)}`}</span>
  }

  const renderLogin = (entry = "/login") => {
    const fetchUser = vi.fn()
    const { container } = render(
      <UserContext.Provider value={{ fetchUser }}>
        <MemoryRouter initialEntries={[entry]}>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/" element={<span>home</span>} />
            <Route path="*" element={<Where />} />
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

  it("goes back to the page in returnTo, with its state", async () => {
    mockFetch({ accessToken: "new-token" })
    const { login, pass, submit } = renderLogin({ pathname: "/login", search: "?returnTo=%2Ftopics%2F1%2Fposts%2F2%3Fcommit%3Dabc", state: { returnState: { id: 1 } } })

    await userEvent.type(login, "alice")
    await userEvent.type(pass, "secret")
    await submit()

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent('/topics/1/posts/2?commit=abc {"id":1}'))
  })

  it("goes home instead of to another site", async () => {
    mockFetch({ accessToken: "new-token" })
    const { login, pass, submit } = renderLogin("/login?returnTo=%2F%2Fevil.test")

    await userEvent.type(login, "alice")
    await userEvent.type(pass, "secret")
    await submit()

    await waitFor(() => expect(screen.getByText("home")).toBeInTheDocument())
  })

  // Signing up turns the form into the login on the same address, as switching modes does
  it("keeps returnTo through the sign up form, for the login that follows", async () => {
    mockFetch({ accessToken: "new-token" })
    renderLogin("/login?returnTo=%2Fprofile")
    await userEvent.click(screen.getByText(/crie uma/))
    await userEvent.click(screen.getByText(/entre/))

    await userEvent.type(document.querySelector("input:not([type])"), "alice")
    await userEvent.type(document.querySelector("input[type=password]"), "secret")
    await userEvent.click(screen.getByRole("button", { name: "entrar" }))

    await waitFor(() => expect(screen.getByTestId("where")).toHaveTextContent("/profile"))
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

describe("useToLogin", () => {
  it("sends the user to the login page, remembering where they were and the page's state", async () => {
    function NeedsLogin() {
      const toLogin = useToLogin()
      return <button onClick={toLogin}>votar</button>
    }
    function ShowLogin() {
      const { search, state } = useLocation()
      return <span data-testid="login">{`${search} ${JSON.stringify(state)}`}</span>
    }
    render(
      <MemoryRouter initialEntries={[{ pathname: "/write", search: "?x=1", state: { id: 7 } }]}>
        <Routes>
          <Route path="/write" element={<NeedsLogin />} />
          <Route path="/login" element={<ShowLogin />} />
        </Routes>
      </MemoryRouter>
    )

    await userEvent.click(screen.getByText("votar"))

    expect(screen.getByTestId("login")).toHaveTextContent('?returnTo=%2Fwrite%3Fx%3D1 {"returnState":{"id":7}}')
  })
})

describe("submitVote", () => {
  it("sends logged out users to the login page", async () => {
    const fetch = mockFetch()
    const toLogin = vi.fn()

    await submitVote(toLogin, 5, "up")

    expect(toLogin).toHaveBeenCalled()
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
