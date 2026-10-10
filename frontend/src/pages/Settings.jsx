import React from "react"
import { PiArrowCounterClockwiseBold, PiWarningBold } from "react-icons/pi"
import { THEME_PRESETS } from "@colcom/shared"

import LoadingButton from "@/components/primitives/LoadingButton"
import { ApiError } from "@/assets/api"
import {
  COLOR_GROUPS, contrastProblems, DEFAULT_THEME, isDefaultTheme, PRESETS, sameTheme, themeColors, withColors
} from "@/assets/themes"
import useTheme from "@/context/ThemeContext"
import useUser from "@/context/UserContext"


// The colors each preset's card shows
const SWATCHES = ["bg", "surface", "text", "green", "orange", "red"]

// Picks and edits the theme. The whole site previews it while it's changed and not saved.
export default function Settings() {
  const { user } = useUser()
  const { saved, saveTheme, previewTheme } = useTheme()
  const [draft, setDraft] = React.useState(saved)
  const [isSaving, setIsSaving] = React.useState(false)
  const [error, setError] = React.useState("")
  const [showColors] = React.useState(() => Boolean(saved.colors))

  // The saved theme changes once the account loads: start over from it
  const [lastSaved, setLastSaved] = React.useState(saved)
  if (lastSaved !== saved) {
    setLastSaved(saved)
    setDraft(saved)
  }

  const colors = themeColors(draft)
  const problems = contrastProblems(colors)
  const isChanged = !sameTheme(draft, saved)

  React.useEffect(() => {
    previewTheme(isChanged ? draft : null)
  }, [draft, isChanged, previewTheme])
  React.useEffect(() => () => previewTheme(null), [previewTheme])

  React.useEffect(() => {
    document.title = "colcom: aparência"
  }, [])

  const edit = theme => {
    setDraft(theme)
    setError("")
  }

  const setColor = (key, value) => edit(withColors(draft.preset, { ...colors, [key]: value }))
  const resetColor = key => edit(withColors(draft.preset, { ...colors, [key]: PRESETS[draft.preset].colors[key] }))

  const save = async () => {
    setIsSaving(true)
    try {
      await saveTheme(draft)
    }
    catch (err) {
      setError(err instanceof ApiError ? err.message : "Não foi possível salvar o tema.")
    }
    finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="content">
      <section className="settings">
        <header>
          <h1>aparência</h1>
          <p>
            {user ?
              "o tema fica salvo na sua conta e vale em todos os dispositivos em que você entrar."
              :
              "o tema fica salvo neste navegador. entre na sua conta para levá-lo a outros dispositivos."
            }
          </p>
        </header>

        <fieldset className="presets">
          <legend>tema</legend>
          {THEME_PRESETS.map(id => (
            <label key={id} className={`preset${draft.preset === id ? " selected" : ""}`}>
              <input type="radio" name="preset" checked={draft.preset === id} onChange={() => edit({ preset: id })} />
              <span className="swatches" aria-hidden="true">
                {SWATCHES.map(key => <span key={key} style={{ backgroundColor: PRESETS[id].colors[key] }} />)}
              </span>
              <span className="presetName">{PRESETS[id].name}</span>
              <small>{PRESETS[id].description}</small>
            </label>
          ))}
        </fieldset>

        <details className="customColors" open={showColors}>
          <summary>personalizar cores</summary>
          <p>as cores partem do tema escolhido; trocar de tema desfaz as mudanças.</p>
          {COLOR_GROUPS.map(group => (
            <fieldset key={group.name}>
              <legend>{group.name}</legend>
              {Object.entries(group.colors).map(([key, label]) => (
                <div key={key} className={`colorField${draft.colors?.[key] ? " changed" : ""}`}>
                  <input type="color" id={`color-${key}`} value={colors[key]} onChange={e => setColor(key, e.target.value)} />
                  <label htmlFor={`color-${key}`}>{label}</label>
                  {draft.colors?.[key] &&
                    <button className="resetColor" title={`restaurar ${label}`} aria-label={`restaurar ${label}`} onClick={() => resetColor(key)}>
                      <PiArrowCounterClockwiseBold />
                    </button>
                  }
                </div>
              ))}
            </fieldset>
          ))}
        </details>

        {problems.length > 0 &&
          <div className="contrastWarning" role="status">
            <p><PiWarningBold /> algumas combinações ficaram difíceis de ler:</p>
            <ul>
              {problems.map(problem => (
                <li key={problem.label}>
                  {problem.label}: {problem.ratio.toFixed(1).replace(".", ",")}:1 (mínimo {String(problem.min).replace(".", ",")}:1)
                </li>
              ))}
            </ul>
          </div>
        }

        <div className="actions">
          {!isDefaultTheme(draft) &&
            <button onClick={() => edit(DEFAULT_THEME)}>usar o padrão</button>
          }
          <button onClick={() => edit(saved)} disabled={!isChanged}>descartar</button>
          <LoadingButton isLoading={isSaving} disabled={!isChanged} onClick={save}>salvar</LoadingButton>
        </div>
        {error && <span className="error">{error}</span>}
      </section>
    </div>
  )
}
