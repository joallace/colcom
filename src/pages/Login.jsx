import React from "react"
import { useNavigate } from "react-router-dom"

import Input from "@/components/Input"
import env from "@/assets/enviroment"

export default function Login() {
  const loginRef = React.useRef()
  const passRef = React.useRef()
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [globalError, setGlobalError] = React.useState(false)
  const navigate = useNavigate()

  const send = async () => {
    const login = loginRef.current.value
    const pass = passRef.current.value

    if (!login || !pass) {
      setError(true)
      return
    }

    try {
      setIsLoading(true)
      setGlobalError(false)

      const res = await fetch(`${env.apiAddress}/login`, {
        method: "post",
        body: JSON.stringify({ login, pass }),
        headers: { "Content-Type": "application/json" }
      })

      const data = await res.json()

      if(res.status >= 400)
        setGlobalError(data.message.toLowerCase())

      if (data.accessToken) {
        localStorage.setItem("accessToken", data.accessToken)
        navigate("/")
      }
    }
    catch (err) {
      setGlobalError("Não foi possível se conectar ao colcom. Por favor, verifique sua conexão.")
      console.error(err)
    }
    finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="login content">
      <div className="loginContainer">
        <div className="header">
          <div className="top bracket" />
          <h1>
            <span>log<span>in</span></span>
          </h1>
          <div className="reverse top critique bracket" />
        </div>
        <div className="body">
          <div className="bracket" />
          <div className="userData">
            {globalError &&
              <div className="globalError">{globalError}</div>
            }
            <Input
              label="email ou nome do usuário"
              inputRef={loginRef}
              disabled={isLoading}
              onChange={e => setError(false)}
              onKeyDown={e => e.key === "Enter" && send()}
              errorMessage={(error && !loginRef.current.value.length) && "campo obrigatório!"}
            />
            <Input
              label="senha"
              inputRef={passRef}
              type="password"
              disabled={isLoading}
              onChange={e => setError(false)}
              onKeyDown={e => e.key === "Enter" && send()}
              errorMessage={(error && !passRef.current.value.length) && "campo obrigatório!"}
            />
            <div className="buttonRow">
              <button disabled={isLoading} onClick={send}>
                {isLoading ?
                  <>
                    <div className="spinner" />
                    entrando...
                  </>
                  :
                  "entrar"}
              </button>
            </div>
          </div>
          <div className="reverse critique bracket" />
        </div>
      </div>
    </div>
  )
}