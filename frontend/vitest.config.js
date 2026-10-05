import { defineConfig, mergeConfig } from "vitest/config"

import viteConfig from "./vite.config.js"


export default mergeConfig(viteConfig, defineConfig({
  test: {
    include: ["test/**/*.test.{js,jsx}"],
    environment: "jsdom",
    setupFiles: ["test/setup.js"],
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
