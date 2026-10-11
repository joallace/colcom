import { CHART_COLORS, THEME_COLORS } from "@colcom/shared"

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
      primary: "#4d6e00", "primary-text": "#476600", accent: "#a84800", "accent-text": "#9c4300",
      danger: "#b52200", "danger-text": "#b02100", highlight: "#a28f00",
      "chart-1": "#a84800", "chart-2": "#4d6e00", "chart-3": "#8a7a00", "chart-4": "#1d6f87",
      "chart-5": "#6e4a9e", "chart-6": "#a83a6e"
    }
  },
  contraste: {
    name: "alto contraste",
    description: "preto e branco, cores mais vivas",
    colors: {
      bg: "#000000", surface: "#0a0a0a", "surface-raised": "#161616", navbar: "#000000",
      text: "#ffffff", "text-secondary": "#e8e8e8", "text-muted": "#c4c4c4",
      primary: "#4f8a00", "primary-text": "#a6e35a", accent: "#cc5500", "accent-text": "#ffa65c",
      danger: "#d42400", "danger-text": "#ff8f78", highlight: "#ffff3d",
      "chart-1": "#cc5500", "chart-2": "#4f8a00", "chart-3": "#ffff3d", "chart-4": "#7fd8f2",
      "chart-5": "#d4a5ff", "chart-6": "#ff8fc0"
    }
  }
}

// Each color's full name: the settings page's fields and the contrast warnings
export const COLOR_LABELS = {
  bg: "fundo", surface: "cartões", "surface-raised": "menus e campos", navbar: "barra de navegação",
  text: "texto", "text-secondary": "texto secundário", "text-muted": "texto discreto",
  primary: "cor primária", "primary-text": "texto primário",
  accent: "cor de destaque", "accent-text": "texto de destaque",
  danger: "cor de erro", "danger-text": "texto de erro",
  highlight: "cor de realce",
  ...Object.fromEntries(CHART_COLORS.map((key, i) => [key, `série ${i + 1} dos gráficos`]))
}

const FILL_AND_TEXT = ["cor", "texto"]

// The colors as the settings page lists them: rows named by what they paint, with a hint of where
// they show (one per color, for a fill and its text variant) and their colors side by side, each
// with a caption when there are several
export const COLOR_GROUPS = [
  {
    name: "superfícies",
    rows: [
      { name: "fundo", hint: "atrás de todo o conteúdo", colors: ["bg"] },
      { name: "cartões", hint: "as respostas de um tema, a caixa de busca, as listas de críticas", colors: ["surface"] },
      { name: "menus e campos", hint: "menus, janelas, balões e caixas de texto", colors: ["surface-raised"] },
      { name: "barra de navegação", hint: "a barra no topo da página", colors: ["navbar"] }
    ]
  },
  {
    name: "texto",
    rows: [
      { name: "texto", hint: "o texto principal", colors: ["text"] },
      { name: "texto secundário", hint: "descrições e informações de apoio", colors: ["text-secondary"] },
      { name: "texto discreto", hint: "datas, contagens e dicas", colors: ["text-muted"] }
    ]
  },
  {
    name: "ênfase",
    rows: [
      {
        name: "primária",
        hint: ["bordas de botões, campos e cartões", "títulos, página atual, voto positivo, etiquetas apoiadas e trechos inseridos"],
        colors: ["primary", "primary-text"],
        captions: FILL_AND_TEXT
      },
      {
        name: "destaque",
        hint: ["botões sob o cursor, campos em foco, seleção e críticas", "links sob o cursor, títulos e citações de críticas, contorno de foco e voto negativo"],
        colors: ["accent", "accent-text"],
        captions: FILL_AND_TEXT
      }
    ]
  },
  {
    name: "avisos",
    rows: [
      {
        name: "erro",
        hint: ["campos com erro, contador de notificações e etiquetas contestadas", "mensagens de erro e trechos removidos"],
        colors: ["danger", "danger-text"],
        captions: FILL_AND_TEXT
      },
      { name: "realce", hint: "trecho selecionado, crítica em foco e críticas em análise", colors: ["highlight"] }
    ]
  },
  {
    name: "gráficos",
    rows: [
      {
        name: "séries",
        hint: "as linhas, barras e fatias de cada gráfico, na ordem em que aparecem",
        colors: CHART_COLORS,
        captions: CHART_COLORS.map((_, i) => String(i + 1))
      }
    ]
  }
]

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

const TEXTS = ["text", "text-secondary", "text-muted", "primary-text", "accent-text", "danger-text"]
const SURFACES = ["bg", "surface", "surface-raised", "navbar"]

// The pairs the interface draws one over the other, and the contrast each needs: 4.5:1 for text,
// 3:1 for the bold white labels on the brand fills and for icons (WCAG's AA)
const PAIRS = [
  ...TEXTS.flatMap(fg => SURFACES.map(bg => ({ fg, bg, min: 4.5 }))),
  ...["primary", "accent", "danger"].map(bg => ({ fg: "#ffffff", bg, min: 3, label: `texto branco sobre ${COLOR_LABELS[bg]}` })),
  // The fills also draw borders and outlines over the page, where charts draw their series too
  ...["primary", "accent", "danger", ...CHART_COLORS].map(fg => ({ fg, bg: "bg", min: 3 })),
  { fg: "highlight", bg: "surface", min: 3 },
  // The passage being critiqued: black text over a darker highlight (_text_editor.scss)
  { fg: "#000000", bg: c => scaleLightness(c.highlight, 0.82), min: 4.5, label: "trecho selecionado (texto preto sobre cor de realce)" },
  // The current page in a pagination
  { fg: "bg", bg: "primary-text", min: 4.5, label: "página atual (fundo sobre texto primário)" }
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
