import React from "react"
import { useNavigate } from "react-router-dom"

import Input from "@/components/Input"
import env from "@/assets/enviroment"

export default function Login() {
  const [login, setLogin] = React.useState("")
  const [pass, setPass] = React.useState("")
  const [isLoading, setIsLoading] = React.useState(false)
  const [error, setError] = React.useState(false)
  const navigate = useNavigate()

  const send = async () => {
    if (!login || !pass){
      setError(true)
      return
    }

    try {
      setIsLoading(true)
      const res = await fetch(`${env.apiAddress}/login`, {
        method: "post",
        body: JSON.stringify({ login, pass }),
        headers: { "Content-Type": "application/json" }
      })

      const data = await res.json()
      if (data.accessToken){
        localStorage.setItem("accessToken", data.accessToken)
        navigate("/")
      }
    }
    catch (err) {
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
            <Input
              label="email ou nome do usuário"
              value={login}
              disabled={isLoading}
              onChange={e => {setLogin(e.target.value); setError(false)}}
              onKeyDown={e => e.key === "Enter" && send()}
              errorMessage={(error && !login.length) && "campo obrigatório!"}
            />
            <Input
              label="senha"
              type="password"
              value={pass}
              disabled={isLoading}
              onChange={e => {setPass(e.target.value); setError(false)}}
              onKeyDown={e => e.key === "Enter" && send()}
              errorMessage={(error && !pass.length) && "campo obrigatório!"}
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