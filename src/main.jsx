import React from "react"
import ReactDOM from "react-dom/client"
import { BrowserRouter } from "react-router-dom"

import App from "@/App.jsx"
import "@/assets/scss/main.scss"
import { ChartProvider } from "@/context/ChartContext"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ChartProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ChartProvider>
  </React.StrictMode>,
)
