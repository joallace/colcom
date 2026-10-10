import { defineConfig, mergeConfig } from "vitest/config"

import viteConfig from "./vite.config.js"


export default mergeConfig(viteConfig, defineConfig({
  test: {
    include: ["test/**/*.test.{js,jsx}"],
    environment: "jsdom",
    setupFiles: ["test/setup.js"],
    // Stylesheets aren't compiled in tests (so components see no breakpoints), except the default
    // theme's colors, which the presets are built from
    css: { include: [/_theme\.module\.scss$/] },
    env: {
      VITE_API_ADDRESS: "http://api.test"
    },
    coverage: {
      provider: "v8",
      include: ["src/**/*.{js,jsx}"],
      exclude: ["src/main.jsx"]
    }
  }
}))
