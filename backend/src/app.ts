import express from "express"
import cors from "cors"
import contentRouter from "@/routes/content"
import interactionsRouter from "@/routes/interactions"
import userRouter from "@/routes/user"
import errorHandler from "@/middleware/errorHandler"

// Kept apart from server.ts so tests can drive the app without binding a port
const app = express()

app.use(cors())
app.use(express.json())
app.use(contentRouter)
app.use(interactionsRouter)
app.use(userRouter)
app.use(errorHandler)

app.get("/", (req, res) => {
  res.send("I'm alive!")
})

export default app