// A theme is a preset and, optionally, some of its colors replaced. Each color is a CSS custom
// property of the frontend (core/_tokens.scss), from which the rest (tints, hovers, borders) are
// derived. The presets' values live in the frontend (assets/themes.js); only their names are here,
// so the API can check what it stores.
export const THEME_PRESETS = ["colcom", "claro", "contraste"]

// Named by what they're used for, not by hue, since any of them may be any color
export const CHART_COLORS = ["chart-1", "chart-2", "chart-3", "chart-4", "chart-5", "chart-6"]

export const THEME_COLORS = [
  "bg", "surface", "surface-raised", "navbar",
  "text", "text-secondary", "text-muted",
  "primary", "primary-text", "accent", "accent-text", "danger", "danger-text", "highlight",
  ...CHART_COLORS
]

// What <input type="color"> gives: six lowercase hex digits
export const HEX_COLOR_PATTERN = "^#[0-9a-f]{6}$"
