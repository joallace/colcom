import React from "react"

import api from "@/assets/api"
import { applyTheme, colorScheme, storedTheme, storeTheme, themeColors } from "@/assets/themes"
import { ThemeContext } from "@/context/ThemeContext"
import useUser from "@/context/UserContext"


// The theme in use: the account's once it's loaded (if the user ever chose one), otherwise the one
// this browser keeps, which is also what's painted before the app loads (public/theme.js)
export default function ThemeProvider({ children }) {
  const { user, updateTheme } = useUser()
  const [browserTheme, setBrowserTheme] = React.useState(storedTheme)
  // A theme shown but not saved, while the settings page edits it
  const [preview, setPreview] = React.useState(null)

  const saved = user?.theme ?? browserTheme
  const theme = preview ?? saved
  const colors = React.useMemo(() => themeColors(theme), [theme])
  const scheme = colorScheme(colors)

  React.useLayoutEffect(() => applyTheme(theme), [theme])
  // The account's theme is cached too, so the next visit paints it at once
  React.useEffect(() => storeTheme(saved), [saved])

  // Saved on the account when logged in, then in this browser. A refusal is thrown and changes
  // nothing, so the settings page keeps previewing what it tried to save.
  const saveTheme = async next => {
    if (user) {
      await api.patch("/users/self", { theme: next })
      updateTheme(next)
    }
    setBrowserTheme(next)
  }

  return (
    <ThemeContext.Provider value={{ theme, saved, colors, scheme, saveTheme, previewTheme: setPreview }}>
      {children}
    </ThemeContext.Provider>
  )
}
