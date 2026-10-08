import React from "react"
import { useLocation, useNavigate, useSearchParams } from "react-router"

import Input from "@/components/primitives/Input"
import LoadingButton from "@/components/primitives/LoadingButton"
import PixelArtEditor from "@/components/primitives/PixelArtEditor"
import { blankGrid, serializeGridToBase64png } from "@/assets/pixelArt"
import Alert from "@/components/primitives/Alert"
import { UserContext } from "@/context/UserContext"
import env from "@/assets/enviroment"
import { formErrors, limits, responseErrors } from "@/assets/validation"
import { returnPath } from "@/assets/returnTo"

const MISMATCHING_PASS = "senhas não estão iguais"
const MISSING_FIELD = "campo obrigatório"
// The API checks uniqueness outside the schemas, naming the field in `key`
const ALREADY_USED = { name: "nome de usuário já utilizado", email: "email já utilizado" }

// The API names the sign up's username "name"; the form's field is "login" in both modes
const toFormKey = key => key === "name" ? "login" : key

export default function Login() {
  const loginRef = React.useRef()
  const emailRef = React.useRef()
  const passRef = React.useRef()
  const confirmPassRef = React.useRef()
  const [profilePicture, setProfilePicture] = React.useState(blankGrid)
  const [isLoading, setIsLoading] = React.useState(false)
  const [isSignUp, setIsSignUp] = React.useState(false)
  // A message for each invalid field, e.g. { login: "campo obrigatório" }
  const [errors, setErrors] = React.useState({})
  const [formErrorMessage, setFormErrorMessage] = React.useState(false)
  const { fetchUser } = React.useContext(UserContext)
  const navigate = useNavigate()
  const { state } = useLocation()
  const [searchParams] = useSearchParams()
  const isPfpEmpty = React.useCallback(() => profilePicture.flat().every(pixel => pixel === ""), [profilePicture])

  const clearError = (...fields) =>
    setErrors(prev => fields.some(field => prev[field]) ? Object.fromEntries(Object.entries(prev).filter(([field]) => !fields.includes(field))) : prev)

  const addError = (field, message) => setErrors(prev => ({ ...prev, [field]: message }))

  const errorMessage = field => errors[field] && `${errors[field]}!`

  const values = () => isSignUp ?
    { name: loginRef.current.value, email: emailRef.current?.value, pass: passRef.current.value, avatar: serializeGridToBase64png(profilePicture) }
    :
    { login: loginRef.current.value, pass: passRef.current.value }

  const validateForm = () => {
    const found = Object.fromEntries(Object.entries(formErrors(isSignUp ? "signUp" : "login", values())).map(([key, message]) => [toFormKey(key), message]))

    if (isSignUp) {
      if (!confirmPassRef.current?.value)
        found.confirmPass = MISSING_FIELD
      else if (confirmPassRef.current.value !== passRef.current.value)
        found.confirmPass = MISMATCHING_PASS

      // A blank grid is still a valid PNG
      if (isPfpEmpty())
        found.avatar = "a foto de perfil é obrigatória"
    }

    return found
  }

  const testPasswords = () => {
    if (confirmPassRef.current?.value.length && (confirmPassRef.current?.value !== passRef.current?.value))
      addError("confirmPass", MISMATCHING_PASS)
    else if (errors.confirmPass === MISMATCHING_PASS)
      clearError("confirmPass")
  }

  // Checks one field as soon as it's left, without flagging the ones not filled in yet
  const testField = field => {
    const message = validateForm()[field]
    if (message && message !== MISSING_FIELD)
      addError(field, message)
  }

  const send = async () => {
    if (Object.keys(errors).length)
      return

    const found = validateForm()
    if (Object.keys(found).length) {
      setErrors(found)
      return
    }

    try {
      setIsLoading(true)
      setFormErrorMessage("")
      const url = `${env.apiAddress}/${isSignUp ? "users" : "login"}`

      const res = await fetch(url, {
        method: "post",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values())
      })

      const data = await res.json()

      if (res.status >= 400) {
        if (data.name === "ValidationError") {
          const found = data.errors ? responseErrors(data) : ALREADY_USED[data.key] ? { [data.key]: ALREADY_USED[data.key] } : {}
          setErrors(Object.fromEntries(Object.entries(found).map(([key, message]) => [toFormKey(key), message])))
        }
        setFormErrorMessage(data.message.toLowerCase())
        return
      }

      if (data.accessToken) {
        localStorage.setItem("accessToken", data.accessToken)
        fetchUser()
      }

      // After signing up the form turns into the login, keeping `returnTo` in the URL for it
      if (isSignUp)
        setIsSignUp(false)
      else
        navigate(returnPath(searchParams.get("returnTo")), { replace: true, state: state?.returnState })
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
                  <h2 className={errors.avatar ? "error" : ""}>foto de perfil</h2>
                  <PixelArtEditor
                    gridState={[profilePicture, setProfilePicture]}
                    error={errors.avatar}
                    popError={() => clearError("avatar")}
                  />
                  <hr />
                </div>
              }
              <Input
                label={`nome do usuário${isSignUp ? "" : " ou email"}`}
                ref={loginRef}
                disabled={isLoading}
                maxLength={isSignUp ? limits.username.max : undefined}
                onChange={() => clearError("login")}
                onBlur={() => isSignUp && testField("login")}
                errorMessage={errorMessage("login")}
              />
              {isSignUp &&
                <Input
                  type="email"
                  label="email"
                  ref={emailRef}
                  disabled={isLoading}
                  maxLength={limits.email.max}
                  onChange={() => clearError("email")}
                  errorMessage={errorMessage("email")}
                  onBlur={() => testField("email")}
                />
              }
              <Input
                type="password"
                label="senha"
                ref={passRef}
                disabled={isLoading}
                onChange={() => clearError("pass", "confirmPass")}
                errorMessage={errorMessage("pass")}
                onBlur={() => { testPasswords(); isSignUp && testField("pass") }}
              />
              {isSignUp &&
                <Input
                  type="password"
                  label="confime a senha"
                  ref={confirmPassRef}
                  disabled={isLoading}
                  onChange={() => clearError("confirmPass")}
                  errorMessage={errorMessage("confirmPass")}
                  onBlur={testPasswords}
                />
              }
            </div>
            <span className="createAccount">
              {isSignUp ? "" : "não "}tem uma conta?
              <a onClick={() => { setIsSignUp(!isSignUp); setErrors({}); setFormErrorMessage("") }}>
                {isSignUp ? " entre" : " crie uma"} agora!
              </a>
            </span>
            <input type="submit" style={{ display: "none" }} />
          </form>
          <div className="reverse critique bracket" />

        </div>
        <div className="spaced">
          <div className="bottom bracket" />
          <div className="buttonRow">
            <LoadingButton type="submit" isLoading={isLoading} onClick={send} disabled={Object.keys(errors).length}>
              {isLoading ?
                isSignUp ? "cadastrando..." : "entrando..."
                :
                isSignUp ? "cadastrar" : "entrar"
              }
            </LoadingButton>
          </div>
          <div className="login reverse bottom critique bracket" />
        </div>
      </div>
    </div>
  )
}
