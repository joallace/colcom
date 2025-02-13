import React from "react"
import { useNavigate } from "react-router-dom"

import Input from "@/components/primitives/Input"
import { UserContext } from "@/context/UserContext"
import env from "@/assets/enviroment"
import PixelArtEditor from "@/components/primitives/PixelArtEditor"

export default function Login() {
  const loginRef = React.useRef()
  const emailRef = React.useRef()
  const passRef = React.useRef()
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSignUp, setIsSignUp] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [globalError, setGlobalError] = React.useState(false)
  const { fetchUser } = React.useContext(UserContext)
  const navigate = useNavigate()

  const send = async () => {
    const login = loginRef.current.value
    const email = emailRef.current?.value
    const pass = passRef.current.value

    if (!login || !pass || (isSignUp && !email)) {
      setError(true)
      return
    }

    try {
      setIsLoading(true)
      setGlobalError(false)
      const url = `${env.apiAddress}/${isSignUp ? "users" : "login"}`
      const body = isSignUp ?
        JSON.stringify({ name: login, email, pass })
        :
        JSON.stringify({ login, pass })

      const res = await fetch(url, {
        method: "post",
        headers: { "Content-Type": "application/json" },
        body
      })

      const data = await res.json()

      if (res.status >= 400) {
        setGlobalError(data.message.toLowerCase())
        return
      }

      if (data.accessToken) {
        localStorage.setItem("accessToken", data.accessToken)
        fetchUser()
      }

      if (isSignUp)
        setIsSignUp(false)
      else
        navigate("/")
    }
    catch (err) {
      setGlobalError("Não foi possível se conectar ao colcom. Por favor, verifique sua conexão.")
      console.error(err)
    }
    finally {
      setIsLoading(false)
    }
  }

  React.useEffect(() => {
    document.title = "Login · colcom"
  }, [])

  return (
    <div className="content login">
      <div className="loginContainer">
        <div className="header">
          <div className="top bracket" />
          <h1>
            {isSignUp ?
              <span>sign<span>up</span></span>
              :
              <span>log<span>in</span></span>
            }
          </h1>
          <div className="reverse top critique bracket" />
        </div>
        <div className="body">
          <div className="bracket" />
          <div className="loginForm">
            {globalError &&
              <div className="globalError">{globalError}</div>
            }
            <div className="userData">
              {
                isSignUp &&
                <>
                  <PixelArtEditor />
                  <hr style={{ width: "100%" }} />
                </>
              }
              <Input
                label={`nome do usuário${isSignUp ? "" : " ou email"}`}
                ref={loginRef}
                disabled={isLoading}
                onChange={() => setError(false)}
                onKeyDown={e => e.key === "Enter" && send()}
                errorMessage={(error && !loginRef.current.value.length) && "campo obrigatório!"}
              />
              {isSignUp &&
                <Input
                  type="email"
                  label="email"
                  ref={emailRef}
                  disabled={isLoading}
                  onChange={() => setError(false)}
                  onKeyDown={e => e.key === "Enter" && send()}
                  errorMessage={(error && !emailRef.current?.value.length) && "campo obrigatório!"}
                />
              }
              <Input
                type="password"
                label="senha"
                ref={passRef}
                disabled={isLoading}
                onChange={() => setError(false)}
                onKeyDown={e => e.key === "Enter" && send()}
                errorMessage={(error && !passRef.current.value.length) && "campo obrigatório!"}
              />
            </div>
            <span className="createAccount">
              {isSignUp ? "" : "não "}tem uma conta?
              <a onClick={() => setIsSignUp(!isSignUp)}>
                {isSignUp ? " entre" : " crie uma"} agora!
              </a>
            </span>

          </div>
          <div className="reverse critique bracket" />

        </div>
        <div className="footer">
          <div className="bottom bracket" />
          <div className="buttonRow">
            <button disabled={isLoading} onClick={send}>
              {isLoading ?
                <>
                  <div className="button spinner" />
                  {isSignUp ?
                    "cadastrando..."
                    :
                    "entrando..."}
                </>
                :
                isSignUp ?
                  "cadastrar"
                  :
                  "entrar"
              }
            </button>
          </div>
          <div className="reverse bottom critique bracket" />
        </div>
      </div>
    </div>
  )
}