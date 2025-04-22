import React from "react"
import ReactDOM from "react-dom/client"

import App from "@/App.jsx"
import "@/assets/scss/main.scss"
import { ChartProvider } from "@/context/ChartContext"
import { UserProvider } from "@/context/UserContext"
import { ThemeProvider } from "./context/ThemeContext"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <UserProvider>
        <ChartProvider>
          <App />
        </ChartProvider>
      </UserProvider>
    </ThemeProvider>
  </React.StrictMode>
)
