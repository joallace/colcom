import { defineConfig } from "vite"
import path from "path"
import react from "@vitejs/plugin-react-swc"

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    // eslint-disable-next-line no-undef
    alias: {
      "@": path.resolve(__dirname, "src"),
      "$fonts": path.resolve(__dirname, "src/assets/fonts")
    }
  },
  css:{
    preprocessorOptions:{
      scss:{
        api: "modern-compiler"
      }
    }
  }
})