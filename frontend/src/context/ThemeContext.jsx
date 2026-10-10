import React from "react"

import { DEFAULT_THEME, themeColors } from "@/assets/themes"


// Provided by `ThemeProvider`, kept in its own file so this one exports no components. Without one
// (in tests), components get the default theme.
export const ThemeContext = React.createContext({
  theme: DEFAULT_THEME,
  colors: themeColors(DEFAULT_THEME),
  scheme: "dark",
  saveTheme: async () => { },
  previewTheme: () => { }
})

export default function useTheme() {
  return React.useContext(ThemeContext)
}
