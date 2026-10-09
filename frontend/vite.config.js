import { defineConfig } from "vite"
import path from "path"
import react from "@vitejs/plugin-react"

import validators from "./plugins/validators.js"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), validators()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "$fonts": path.resolve(import.meta.dirname, "src/assets/fonts")
    }
  }
})
