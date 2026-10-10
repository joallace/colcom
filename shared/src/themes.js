// A theme is a preset and, optionally, some of its colors replaced. Each color is a CSS custom
// property of the frontend (core/_tokens.scss), from which the rest (tints, hovers, borders) are
// derived. The presets' values live in the frontend (assets/themes.js); only their names are here,
// so the API can check what it stores.
export const THEME_PRESETS = ["colcom", "claro", "contraste"]

export const THEME_COLORS = [
  "bg", "surface", "surface-raised", "navbar",
  "text", "text-secondary", "text-muted",
  "green", "green-text", "orange", "orange-text", "red", "red-text", "yellow", "blue"
]

// What <input type="color"> gives: six lowercase hex digits
export const HEX_COLOR_PATTERN = "^#[0-9a-f]{6}$"
