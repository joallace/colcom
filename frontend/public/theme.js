// Paints the theme assets/themes.js cached before the app loads, so a chosen theme doesn't flash the
// default one first. Loaded by index.html's <head>, as a file, since the CSP refuses inline scripts.
try {
  const { colors, scheme } = JSON.parse(localStorage.getItem("theme"))
  const root = document.documentElement

  for (const [key, value] of Object.entries(colors))
    if (/^[a-z-]+$/.test(key) && /^#[0-9a-f]{6}$/.test(value))
      root.style.setProperty(`--${key}`, value)
  root.dataset.scheme = scheme === "light" ? "light" : "dark"
}
catch {
  // Nothing cached (or no storage): the stylesheet's default theme
}
