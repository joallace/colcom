import React from "react"
import { useNavigate } from "react-router-dom"

import Input from "@/components/primitives/Input"
import LoadingButton from "@/components/primitives/LoadingButton"
import PixelArtEditor, { blankGrid, serializeGridToBase64 } from "@/components/primitives/PixelArtEditor"
import Alert from "@/components/primitives/Alert"
import { UserContext } from "@/context/UserContext"
import env from "@/assets/enviroment"

export default function Login() {
  const loginRef = React.useRef()
  const emailRef = React.useRef()
  const passRef = React.useRef()
  const [profilePicture, setProfilePicture] = React.useState(blankGrid)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSignUp, setIsSignUp] = React.useState(false)
  const [error, setError] = React.useState(false)
  const [errorMessage, setErrorMessage] = React.useState(false)
  const { fetchUser } = React.useContext(UserContext)
  const navigate = useNavigate()
  const isPfpEmpty = React.useCallback(() => profilePicture.flat().every(pixel => pixel === ""), [profilePicture, error])

  const send = async () => {
    const login = loginRef.current.value
    const email = emailRef.current?.value
    const pass = passRef.current.value

    if (!login || !pass || (isSignUp && (!email || isPfpEmpty()))) {
      setError(true)
      return
    }

    try {
      setIsLoading(true)
      setErrorMessage("")
      const url = `${env.apiAddress}/${isSignUp ? "users" : "login"}`
      const body = isSignUp ?
        JSON.stringify({ name: login, email, pass, avatar: serializeGridToBase64(profilePicture) })
        :
        JSON.stringify({ login, pass })

      const res = await fetch(url, {
        method: "post",
        headers: { "Content-Type": "application/json" },
        body
      })

      const data = await res.json()

      if (res.status >= 400) {
        setErrorMessage(data.message.toLowerCase())
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
      setErrorMessage("Não foi possível se conectar ao colcom. Por favor, verifique sua conexão.")
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
    <div className="content login centered">
      <div className="loginContainer">
        <div className="spaced header">
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
        <div className="spaced body">
          <div className="bracket" />
          <div className="loginForm">
            <Alert setter={setErrorMessage}>
              {errorMessage}
            </Alert>
            <div className="userData">
              {
                isSignUp &&
                <div className="profilePictureCanvas">
                  <h2 className={error && isPfpEmpty() ? "error" : ""}>foto de perfil</h2>
                  <PixelArtEditor
                    gridState={[profilePicture, setProfilePicture]}
                    error={(error && isPfpEmpty())}
                  />
                  <hr />
                </div>
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
              <a onClick={() => { setIsSignUp(!isSignUp); setError(false); setErrorMessage("") }}>
                {isSignUp ? " entre" : " crie uma"} agora!
              </a>
            </span>

          </div>
          <div className="reverse critique bracket" />

        </div>
        <div className="spaced">
          <div className="bottom bracket" />
          <div className="buttonRow">
            <LoadingButton isLoading={isLoading} onClick={send}>
              {isLoading ?
                isSignUp ? "cadastrando..." : "entrando..."
                :
                isSignUp ? "cadastrar" : "entrar"
              }
            </LoadingButton>
          </div>
          <div className="reverse bottom critique bracket" />
        </div>
      </div>
    </div>
  )
}