import React from "react"
import ReactDOM from "react-dom/client"

import App from "@/App.jsx"
import "@/assets/scss/main.scss"
import ChartProvider from "@/context/ChartProvider"
import UserProvider from "@/context/UserProvider"

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <UserProvider>
      <ChartProvider>
        <App />
      </ChartProvider>
    </UserProvider>
  </React.StrictMode>
)
