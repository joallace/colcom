import React from "react"
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router"

import { default as Editor } from "@/components/Editor"
import Frame from "@/components/primitives/Frame"
import Alert from "@/components/primitives/Alert"
import Input from "@/components/primitives/Input"
import LoadingButton from "@/components/primitives/LoadingButton"
import Spinner from "@/components/primitives/Spinner"
import env from "@/assets/enviroment"
import { describe, validate } from "@/assets/validation"
import { loginPath } from "@/assets/returnTo"
import { conflictContexts, conflictsOf, mergeChunks, resolveChunks } from "@/assets/mergeConflicts"
import useUser from "@/context/UserContext"


const SIDES = [["ours", "sua versão"], ["theirs", "sugestão"]]

const OPTIONS = [["ours", "manter a sua versão"], ["theirs", "usar a sugestão"], ["both", "manter as duas, a sua primeiro"]]

// Which sides a choice keeps, to mark them
const keeps = (choice, side) => choice === side || choice === "both"

// Where the author of a post accepts a suggestion that changes passages they also changed after it
// was made. They pick what stays of each conflict, then review (and may edit) the merged text, which
// is sent with the version of the post it was resolved against: if the post changed meanwhile, the
// API refuses it and the conflicts are loaded again.
export default function ResolveSuggestion() {
  const { tid, pid, hash } = useParams()
  const { user } = useUser()
  const location = useLocation()
  const navigate = useNavigate()
  // Raised to start over from the post's current version
  const [attempt, setAttempt] = React.useState(0)
  // What was loaded, and for which request; it's loading until that's the current one
  const [loaded, setLoaded] = React.useState({})
  const [choices, setChoices] = React.useState([])
  // The merged text under review; undefined while choosing
  const [result, setResult] = React.useState()
  const [error, setError] = React.useState("")
  const [headMoved, setHeadMoved] = React.useState(false)
  const [isSending, setIsSending] = React.useState(false)
  const request = `${pid}/${hash}/${attempt}`
  const isLoading = loaded.request !== request || loaded.user !== user
  const postPath = `/topics/${tid}/posts/${pid}`

  React.useEffect(() => {
    if (!user)
      return

    const load = async () => {
      const headers = { "Authorization": `Bearer ${user.accessToken}` }
      try {
        const [sidesRes, postRes] = await Promise.all([
          fetch(`${env.apiAddress}/contents/${pid}/${hash}/merge`, { headers }),
          fetch(`${env.apiAddress}/contents/${pid}?omit_body`, { headers })
        ])
        const [sides, post] = await Promise.all([sidesRes.json(), postRes.json()])

        if (!sidesRes.ok) {
          setLoaded({ request, user, error: sides.message })
          return
        }

        if (postRes.ok)
          document.title = `incorporando uma sugestão a "${post.title}" · colcom`
        setLoaded({ request, user, sides, post: postRes.ok ? post : undefined })
      }
      catch (err) {
        console.error(err)
        setLoaded({ request, user, error: "Não foi possível carregar a sugestão." })
      }
    }

    load()
  }, [user, pid, hash, request])

  const chunks = React.useMemo(() => loaded.sides ? mergeChunks(loaded.sides) : [], [loaded.sides])
  const conflicts = conflictsOf(chunks)
  const contexts = React.useMemo(() => conflictContexts(chunks), [chunks])
  const suggestion = loaded.post?.suggestions?.find(item => item.config.commit === hash)
  const allChosen = conflicts.every((_, i) => choices[i])

  const choose = (index, choice) => setChoices(previous => {
    const next = [...previous]
    next[index] = choice
    return next
  })

  const startOver = () => {
    setChoices([])
    setResult(undefined)
    setError("")
    setHeadMoved(false)
    setAttempt(previous => previous + 1)
  }

  const submit = async () => {
    const values = { body: result, head: loaded.sides.head.commit }
    const [invalid] = validate("resolution", values).errors

    if (invalid) {
      setError(describe(invalid))
      return
    }

    try {
      setIsSending(true)
      const res = await fetch(`${env.apiAddress}/contents/${pid}/${hash}/merge`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${user.accessToken}` },
        body: JSON.stringify(values)
      })

      if (res.ok) {
        navigate(postPath)
        return
      }

      const data = await res.json()
      setError(data.message)
      setHeadMoved(data.errorLocationCode === "GIT:MERGE:HEAD_MOVED")
    }
    catch (err) {
      console.error(err)
      setError("Não foi possível incorporar a sugestão.")
    }
    finally {
      setIsSending(false)
    }
  }

  if (user === null)
    return <Navigate to={loginPath(location)} replace />

  if (isLoading)
    return <div className="centered content"><Spinner /></div>

  if (loaded.error)
    return (
      <div className="content resolve">
        <p className="resolveIntro">{loaded.error}</p>
        <Link to={postPath}>voltar ao post</Link>
      </div>
    )

  return (
    <div className="content wide resolve">
      <div className="topicName">
        incorporando {suggestion ?
          <>a sugestão &quot;<strong>{suggestion.config.message}</strong>&quot; de <strong>{suggestion.author}</strong></>
          :
          "uma sugestão"
        } ao post &quot;<Link to={postPath}>{loaded.post?.title ?? "..."}</Link>&quot;
      </div>

      {result === undefined ?
        <>
          <p className="resolveIntro">
            {conflicts.length === 0 ?
              "A sugestão não conflita mais com o post. Revise o resultado antes de incorporá-la."
              :
              `${conflicts.length === 1 ? "Um trecho foi alterado" : `${conflicts.length} trechos foram alterados`} tanto pela sugestão quanto por você depois dela. Escolha o que fica de cada um; o resto das duas versões já foi combinado.`
            }
          </p>

          {conflicts.length > 0 &&
            <div className="diffLegend">
              em cada lado, o que mudou em relação ao texto em que a sugestão foi feita:
              <span className="diffInsert">adicionado</span>
              <span className="diffDelete">removido</span>
            </div>
          }

          <ol className="conflicts">
            {conflicts.map((conflict, i) =>
              <li key={`${request}-${i}`}>
                <fieldset className="conflict">
                  <legend>conflito {i + 1} de {conflicts.length}</legend>

                  {contexts[i].before && <p className="context">…{contexts[i].before}</p>}

                  <div className="sides">
                    {SIDES.map(([side, label]) =>
                      <section key={side} className={`side${keeps(choices[i], side) ? " kept" : ""}`} aria-label={label}>
                        <h3>{label}</h3>
                        {conflict[side] ?
                          <Editor content={conflict[side]} diffBase={conflict.base || undefined} diffLabel={null} bubbleMenuShouldShow={false} />
                          :
                          <p className="removed">trecho removido</p>
                        }
                      </section>
                    )}
                  </div>

                  {contexts[i].after && <p className="context">{contexts[i].after}…</p>}

                  <div className="choices">
                    {OPTIONS.map(([choice, label]) =>
                      <Input
                        key={choice}
                        id={`conflict-${i}-${choice}`}
                        name={`conflict-${i}`}
                        type="radio"
                        value={choice}
                        label={label}
                        checked={choices[i] === choice}
                        onChange={() => choose(i, choice)}
                      />
                    )}
                  </div>
                </fieldset>
              </li>
            )}
          </ol>

          <div className="buttons">
            <button className="error" onClick={() => navigate(postPath)}>cancelar</button>
            <button disabled={!allChosen} onClick={() => setResult(resolveChunks(chunks, choices))}>revisar o resultado</button>
          </div>
        </>
        :
        <>
          <p className="resolveIntro">Este é o texto que ficará no post. Corrija o que for preciso antes de incorporar a sugestão.</p>

          <Frame title={loaded.post?.title ?? ""} hideVoteButtons justify>
            <Editor
              content={result}
              setContent={setResult}
              edit
              diffBase={loaded.sides.head.body}
              diffLabel="comparando com a versão atual do post:"
            />
          </Frame>

          {error &&
            <Alert setter={setError}>
              {error}
              {headMoved && <button onClick={startOver}>recomeçar com a versão atual</button>}
            </Alert>
          }

          <div className="buttons">
            <button className="error" onClick={() => { setResult(undefined); setError("") }}>refazer as escolhas</button>
            <LoadingButton isLoading={isSending} onClick={submit}>
              {isSending ? "incorporando..." : "incorporar"}
            </LoadingButton>
          </div>
        </>
      }
    </div>
  )
}
