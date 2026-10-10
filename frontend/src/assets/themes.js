import { THEME_COLORS } from "@colcom/shared"

import defaultColors from "@/assets/scss/_theme.module.scss"


// A theme is { preset, colors? }: a preset with some of its colors replaced, as the API stores it
// (the `settings` schema in shared/). Each color is a custom property of core/_tokens.scss, which
// derives every other color from them.
export const DEFAULT_THEME = Object.freeze({ preset: "colcom" })

// The cached theme, also read by public/theme.js to paint it before the app loads
export const THEME_KEY = "theme"

export const PRESETS = {
  colcom: {
    name: "colcom",
    description: "escuro, em tons de terra",
    // The stylesheet's own colors (abstracts/_variables.scss)
    colors: Object.fromEntries(THEME_COLORS.map(key => [key, defaultColors[key]]))
  },
  claro: {
    name: "claro",
    description: "fundo claro, como papel",
    colors: {
      bg: "#f7f1ea", surface: "#fffcf8", "surface-raised": "#ffffff", navbar: "#efe4d7",
      text: "#24170c", "text-secondary": "#54442f", "text-muted": "#6b5a48",
      green: "#4d6e00", "green-text": "#476600", orange: "#a84800", "orange-text": "#9c4300",
      red: "#b52200", "red-text": "#b02100", yellow: "#a28f00", blue: "#1d6f87"
    }
  },
  contraste: {
    name: "alto contraste",
    description: "preto e branco, cores mais vivas",
    colors: {
      bg: "#000000", surface: "#0a0a0a", "surface-raised": "#161616", navbar: "#000000",
      text: "#ffffff", "text-secondary": "#e8e8e8", "text-muted": "#c4c4c4",
      green: "#4f8a00", "green-text": "#a6e35a", orange: "#cc5500", "orange-text": "#ffa65c",
      red: "#d42400", "red-text": "#ff8f78", yellow: "#ffff3d", blue: "#7fd8f2"
    }
  }
}

// The colors as the settings page lists them
export const COLOR_GROUPS = [
  {
    name: "superfícies",
    colors: { bg: "fundo", surface: "cartões", "surface-raised": "menus e campos", navbar: "barra de navegação" }
  },
  {
    name: "texto",
    colors: { text: "texto", "text-secondary": "texto secundário", "text-muted": "texto discreto" }
  },
  {
    name: "cores",
    colors: {
      green: "verde", "green-text": "texto verde", orange: "laranja", "orange-text": "texto laranja",
      red: "vermelho", "red-text": "texto vermelho", yellow: "amarelo", blue: "azul"
    }
  }
]

export const COLOR_LABELS = Object.assign({}, ...COLOR_GROUPS.map(group => group.colors))

// The theme's colors, every one of them: its preset's, with its own over them
export const themeColors = theme =>
  ({ ...(PRESETS[theme?.preset] ?? PRESETS.colcom).colors, ...theme?.colors })

// Only the colors that differ from the preset, so a theme stores what was actually changed
export function withColors(preset, colors) {
  const base = PRESETS[preset].colors
  const changed = Object.fromEntries(Object.entries(colors).filter(([key, value]) => base[key] !== value))
  return Object.keys(changed).length > 0 ? { preset, colors: changed } : { preset }
}

export const isDefaultTheme = theme => !theme || (theme.preset === "colcom" && !Object.keys(theme.colors ?? {}).length)

export const sameTheme = (a, b) => {
  const [x, y] = [themeColors(a), themeColors(b)]
  return a?.preset === b?.preset && THEME_COLORS.every(key => x[key] === y[key])
}

const channels = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255)

// WCAG's relative luminance and contrast ratio
export function luminance(hex) {
  const [r, g, b] = channels(hex).map(c => c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

export function contrastRatio(a, b) {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

// Light or dark, by whether black or white reads better on the background
export const colorScheme = colors =>
  contrastRatio(colors.bg, "#000000") > contrastRatio(colors.bg, "#ffffff") ? "light" : "dark"

// `hex` with its HSL lightness multiplied by `factor`, as the stylesheet's `hsl(from …)` shades do
export function scaleLightness(hex, factor) {
  const [r, g, b] = channels(hex)
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
  const l = (max + min) / 2
  const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1))
  const h = d === 0 ? 0 : max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4

  const scaled = l * factor
  const c = (1 - Math.abs(2 * scaled - 1)) * s
  const x = c * (1 - Math.abs(h % 2 - 1))
  const m = scaled - c / 2
  const rgb = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h) % 6]
  return "#" + rgb.map(v => Math.round((v + m) * 255).toString(16).padStart(2, "0")).join("")
}

const TEXTS = ["text", "text-secondary", "text-muted", "green-text", "orange-text", "red-text"]
const SURFACES = ["bg", "surface", "surface-raised", "navbar"]

// The pairs the interface draws one over the other, and the contrast each needs: 4.5:1 for text,
// 3:1 for the bold white labels on the brand fills and for icons (WCAG's AA)
const PAIRS = [
  ...TEXTS.flatMap(fg => SURFACES.map(bg => ({ fg, bg, min: 4.5 }))),
  ...["green", "orange", "red"].map(bg => ({ fg: "#ffffff", bg, min: 3, label: `texto branco sobre ${COLOR_LABELS[bg]}` })),
  // The fills also draw borders, outlines and charts' series over the page
  ...["green", "orange", "red"].map(fg => ({ fg, bg: "bg", min: 3 })),
  { fg: "yellow", bg: "surface", min: 3 },
  // The passage being critiqued: black text over a darker yellow (_text_editor.scss)
  { fg: "#000000", bg: c => scaleLightness(c.yellow, 0.82), min: 4.5, label: "trecho selecionado (texto preto sobre amarelo)" },
  // The current page in a pagination
  { fg: "bg", bg: "green-text", min: 4.5, label: "página atual (fundo sobre texto verde)" }
]

const resolve = (colors, value) => typeof value === "function" ? value(colors) : colors[value] ?? value

// The pairs of a theme's colors that are hard to read, with their ratio
export const contrastProblems = colors => PAIRS
  .map(pair => ({ ...pair, ratio: contrastRatio(resolve(colors, pair.fg), resolve(colors, pair.bg)) }))
  .filter(pair => pair.ratio < pair.min)
  .map(({ fg, bg, min, ratio, label }) => ({
    label: label ?? `${COLOR_LABELS[fg]} sobre ${COLOR_LABELS[bg]}`,
    ratio,
    min
  }))

// Sets the theme's colors on <html>, over the stylesheet's; the default theme just removes them
export function applyTheme(theme, root = document.documentElement) {
  const colors = themeColors(theme)
  const isDefault = isDefaultTheme(theme)

  for (const key of THEME_COLORS) {
    if (isDefault)
      root.style.removeProperty(`--${key}`)
    else
      root.style.setProperty(`--${key}`, colors[key])
  }
  root.dataset.scheme = colorScheme(colors)
}

// localStorage may be unavailable (private windows, blocked storage); a theme is never worth failing for
export function storedTheme() {
  try {
    return JSON.parse(localStorage.getItem(THEME_KEY))?.theme ?? DEFAULT_THEME
  }
  catch {
    return DEFAULT_THEME
  }
}

export function storeTheme(theme) {
  try {
    if (isDefaultTheme(theme))
      localStorage.removeItem(THEME_KEY)
    else {
      const colors = themeColors(theme)
      localStorage.setItem(THEME_KEY, JSON.stringify({ theme, colors, scheme: colorScheme(colors) }))
    }
  }
  catch (err) {
    console.error(err)
  }
}
