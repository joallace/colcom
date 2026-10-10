import React from "react"
import ReactDOM from "react-dom/client"

import App from "@/App.jsx"
import "@/assets/scss/main.scss"
import ChartProvider from "@/context/ChartProvider"
import ThemeProvider from "@/context/ThemeProvider"
import UserProvider from "@/context/UserProvider"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <UserProvider>
      <ThemeProvider>
        <ChartProvider>
          <App />
        </ChartProvider>
      </ThemeProvider>
    </UserProvider>
  </React.StrictMode>
)
