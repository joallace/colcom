import React from "react"
import { useNavigate } from "react-router-dom"

import Input from "@/components/primitives/Input"
import LoadingButton from "@/components/primitives/LoadingButton"
import PixelArtEditor, { blankGrid, serializeGridToBase64png } from "@/components/primitives/PixelArtEditor"
import Alert from "@/components/primitives/Alert"
import { UserContext } from "@/context/UserContext"
import env from "@/assets/enviroment"

const ERROR_CODES = {
  EMPTY_FIELD: 0,
  MISMATCHING_PASS: 1,
  INVALID_EMAIL: 2,
}
const ERROR_MSGS = ["campo obrigatório!", "senhas não estão iguais!", "email inválido!"]

export default function Login() {
  const loginRef = React.useRef()
  const emailRef = React.useRef()
  const passRef = React.useRef()
  const confirmPassRef = React.useRef()
  const [profilePicture, setProfilePicture] = React.useState(blankGrid)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSignUp, setIsSignUp] = React.useState(false)
  const [errors, setErrors] = React.useState([])
  const [formErrorMessage, setFormErrorMessage] = React.useState(false)
  const { fetchUser } = React.useContext(UserContext)
  const navigate = useNavigate()
  const isPfpEmpty = React.useCallback(() => profilePicture.flat().every(pixel => pixel === ""), [profilePicture, errors])

  const pushError = (errorCode) => {
    if (!errors.includes(errorCode))
      setErrors([...errors, errorCode])
  }
  const popError = (errorCode) => {
    const index = errors.indexOf(errorCode)
    if (index >= 0)
      setErrors(errors.toSpliced(index, 1))
  }

  const testPasswords = () => {
    if (confirmPassRef.current?.value.length && (confirmPassRef.current?.value !== passRef.current?.value))
      pushError(ERROR_CODES.MISMATCHING_PASS) // 1 => the passwords are not corresponding
    else
      popError(ERROR_CODES.MISMATCHING_PASS)
  }

  const passErrorMsg = (ref) => (
    (
      errors.includes(ERROR_CODES.EMPTY_FIELD)
      && !ref.current.value.length
      && ERROR_MSGS[ERROR_CODES.EMPTY_FIELD]
    )
    ||
    (
      errors.includes(ERROR_CODES.MISMATCHING_PASS)
      && confirmPassRef.current?.value.length
      && (passRef.current?.value !== confirmPassRef.current?.value)
      && ERROR_MSGS[ERROR_CODES.MISMATCHING_PASS]
    )
  )

  const send = async () => {
    if (errors.length)
      return

    const login = loginRef.current.value
    const email = emailRef.current?.value
    const pass = passRef.current.value

    if (!login || !pass || (isSignUp && (!email || isPfpEmpty()))) {
      pushError(ERROR_CODES.EMPTY_FIELD)
      return
    }

    try {
      setIsLoading(true)
      setFormErrorMessage("")
      const url = `${env.apiAddress}/${isSignUp ? "users" : "login"}`
      const body = isSignUp ?
        JSON.stringify({ name: login, email, pass, avatar: serializeGridToBase64png(profilePicture) })
        :
        JSON.stringify({ login, pass })

      const res = await fetch(url, {
        method: "post",
        headers: { "Content-Type": "application/json" },
        body
      })

      const data = await res.json()

      if (res.status >= 400) {
        setFormErrorMessage(data.message.toLowerCase())
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
      setFormErrorMessage("Não foi possível se conectar ao colcom. Por favor, verifique sua conexão.")
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
          <form className="loginForm" onSubmit={e => { e.preventDefault(); send() }}>
            <Alert setter={setFormErrorMessage}>
              {formErrorMessage}
            </Alert>
            <div className="userData">
              {
                isSignUp &&
                <div className="profilePictureCanvas">
                  <h2 className={errors.includes(ERROR_CODES.EMPTY_FIELD) && isPfpEmpty() ? "error" : ""}>foto de perfil</h2>
                  <PixelArtEditor
                    gridState={[profilePicture, setProfilePicture]}
                    error={(errors.includes(ERROR_CODES.EMPTY_FIELD) && isPfpEmpty())}
                  />
                  <hr />
                </div>
              }
              <Input
                label={`nome do usuário${isSignUp ? "" : " ou email"}`}
                ref={loginRef}
                disabled={isLoading}
                onChange={() => popError(ERROR_CODES.EMPTY_FIELD)}
                errorMessage={(errors.includes(ERROR_CODES.EMPTY_FIELD) && !loginRef.current.value.length) && ERROR_MSGS[ERROR_CODES.EMPTY_FIELD]}
              />
              {isSignUp &&
                <Input
                  type="email"
                  label="email"
                  ref={emailRef}
                  disabled={isLoading}
                  onChange={() => { popError(ERROR_CODES.EMPTY_FIELD); popError(ERROR_CODES.INVALID_EMAIL) }}
                  errorMessage={(
                    (
                      errors.includes(ERROR_CODES.EMPTY_FIELD)
                      && !emailRef.current?.value.length
                      && ERROR_MSGS[ERROR_CODES.EMPTY_FIELD]
                    )
                    ||
                    (
                      errors.includes(ERROR_CODES.INVALID_EMAIL)
                      && !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(emailRef.current?.value.length)
                      && ERROR_MSGS[ERROR_CODES.INVALID_EMAIL]
                    )
                  )}
                  onBlur={() => {
                    const value = emailRef.current.value
                    if (value.length && !/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/.test(value))
                      pushError(ERROR_CODES.INVALID_EMAIL)   // 2 => invalid email 
                  }}
                />
              }
              <Input
                type="password"
                label="senha"
                ref={passRef}
                disabled={isLoading}
                onChange={() => { popError(ERROR_CODES.EMPTY_FIELD); popError(ERROR_CODES.MISMATCHING_PASS) }}
                errorMessage={passErrorMsg(passRef)}
                onBlur={testPasswords}
              />
              {isSignUp &&
                <Input
                  type="password"
                  label="confime a senha"
                  ref={confirmPassRef}
                  disabled={isLoading}
                  onChange={() => { popError(ERROR_CODES.EMPTY_FIELD); popError(ERROR_CODES.MISMATCHING_PASS) }}
                  errorMessage={passErrorMsg(confirmPassRef)}
                  onBlur={testPasswords}
                />
              }
            </div>
            <span className="createAccount">
              {isSignUp ? "" : "não "}tem uma conta?
              <a onClick={() => { setIsSignUp(!isSignUp); setErrors([]); setFormErrorMessage("") }}>
                {isSignUp ? " entre" : " crie uma"} agora!
              </a>
            </span>

          </form>
          <div className="reverse critique bracket" />

        </div>
        <div className="spaced">
          <div className="bottom bracket" />
          <div className="buttonRow">
            <LoadingButton isLoading={isLoading} onClick={send} disabled={errors.length}>
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