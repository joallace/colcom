import { describe, expect, it } from "vitest"
import { THEME_COLORS, THEME_PRESETS } from "@colcom/shared"

import {
  applyTheme, colorScheme, contrastProblems, contrastRatio, DEFAULT_THEME, isDefaultTheme, PRESETS,
  sameTheme, scaleLightness, storedTheme, storeTheme, THEME_KEY, themeColors, withColors
} from "@/assets/themes"


describe("presets", () => {
  it("are the ones the API accepts, each with every color", () => {
    expect(Object.keys(PRESETS)).toEqual(THEME_PRESETS)
    for (const preset of Object.values(PRESETS))
      expect(Object.keys(preset.colors).sort()).toEqual([...THEME_COLORS].sort())
  })

  it("start from the stylesheet's colors", () => {
    expect(PRESETS.colcom.colors).toMatchObject({ bg: "#1a0e06", text: "#efe6dc", accent: "#bc5200", "danger-text": "#ff6a4d", "chart-4": "#4da8c1" })
  })

  it.each(THEME_PRESETS)("%s is readable", preset => {
    expect(contrastProblems(PRESETS[preset].colors)).toEqual([])
  })

  it("tell light from dark by the background", () => {
    expect(colorScheme(PRESETS.colcom.colors)).toBe("dark")
    expect(colorScheme(PRESETS.claro.colors)).toBe("light")
    expect(colorScheme(PRESETS.contraste.colors)).toBe("dark")
  })
})

describe("themeColors and withColors", () => {
  it("lays a theme's colors over its preset's", () => {
    expect(themeColors({ preset: "claro", colors: { bg: "#ffffff" } })).toEqual({ ...PRESETS.claro.colors, bg: "#ffffff" })
    expect(themeColors(undefined)).toEqual(PRESETS.colcom.colors)
    expect(themeColors({ preset: "gone" })).toEqual(PRESETS.colcom.colors)
  })

  it("keeps only the colors that differ from the preset", () => {
    expect(withColors("claro", { ...PRESETS.claro.colors, bg: "#ffffff" })).toEqual({ preset: "claro", colors: { bg: "#ffffff" } })
    expect(withColors("claro", PRESETS.claro.colors)).toEqual({ preset: "claro" })
  })

  it("compares themes by their colors", () => {
    expect(sameTheme({ preset: "claro" }, { preset: "claro", colors: { bg: PRESETS.claro.colors.bg } })).toBe(true)
    expect(sameTheme({ preset: "claro" }, { preset: "claro", colors: { bg: "#000000" } })).toBe(false)
    expect(isDefaultTheme(DEFAULT_THEME)).toBe(true)
    expect(isDefaultTheme({ preset: "colcom", colors: { bg: "#000000" } })).toBe(false)
  })
})

describe("contrast", () => {
  it("follows WCAG", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21)
    expect(contrastRatio("#777777", "#ffffff")).toBeCloseTo(4.48, 2)
  })

  it("scales lightness as the stylesheet's hsl(from …) does", () => {
    // Sass' color.scale(#cdcd00, $lightness: -18%), what the default theme drew before
    expect(scaleLightness("#cdcd00", 0.82)).toBe("#a8a800")
  })

  it("names the pairs that are hard to read", () => {
    const problems = contrastProblems({ ...PRESETS.colcom.colors, "text-muted": "#3a2a1a" })

    expect(problems.map(p => p.label)).toEqual([
      "texto discreto sobre fundo", "texto discreto sobre cartões",
      "texto discreto sobre menus e campos", "texto discreto sobre barra de navegação"
    ])
    expect(problems[0]).toMatchObject({ min: 4.5, ratio: expect.any(Number) })
  })

  it("checks the charts' series and the role colors by their names", () => {
    const problems = contrastProblems({ ...PRESETS.colcom.colors, "chart-2": "#1a0e06", accent: "#ffffff" })

    expect(problems.map(p => p.label)).toEqual(["texto branco sobre cor de destaque", "série 2 dos gráficos sobre fundo"])
  })
})

describe("applyTheme", () => {
  it("sets every color on the root, and removes them for the default theme", () => {
    const root = document.createElement("html")

    applyTheme({ preset: "claro", colors: { bg: "#ffffff" } }, root)
    expect(root.style.getPropertyValue("--bg")).toBe("#ffffff")
    expect(root.style.getPropertyValue("--text")).toBe(PRESETS.claro.colors.text)
    expect(root.dataset.scheme).toBe("light")

    applyTheme(DEFAULT_THEME, root)
    expect(root.style.getPropertyValue("--bg")).toBe("")
    expect(root.dataset.scheme).toBe("dark")
  })
})

describe("storeTheme", () => {
  it("caches the theme with its colors for public/theme.js, and forgets the default one", () => {
    storeTheme({ preset: "contraste" })
    expect(JSON.parse(localStorage.getItem(THEME_KEY))).toEqual({ theme: { preset: "contraste" }, colors: PRESETS.contraste.colors, scheme: "dark" })
    expect(storedTheme()).toEqual({ preset: "contraste" })

    storeTheme(DEFAULT_THEME)
    expect(localStorage.getItem(THEME_KEY)).toBeNull()
    expect(storedTheme()).toEqual(DEFAULT_THEME)
  })

  it("falls back to the default when what's stored can't be read", () => {
    localStorage.setItem(THEME_KEY, "{not json")
    expect(storedTheme()).toEqual(DEFAULT_THEME)
  })
})
