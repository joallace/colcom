import express from "express"
import cors from "cors"
import config from "@/config"
import contentRouter from "@/routes/content"
import interactionsRouter from "@/routes/interactions"
import userRouter from "@/routes/user"
import notificationsRouter from "@/routes/notifications"
import tagsRouter from "@/routes/tags"
import metaRouter from "@/routes/meta"
import searchRouter from "@/routes/search"
import errorHandler from "@/middleware/errorHandler"
import { NotFoundError } from "@/errors"

// Kept apart from server.ts so tests can drive the app without binding a port
const app = express()

// nginx sits in front, so req.ip (which the rate limits key on) has to come from X-Forwarded-For
app.set("trust proxy", config.trustProxy)

app.use(cors({ origin: config.corsOrigins }))
app.use(express.json())
app.use(contentRouter)
app.use(interactionsRouter)
app.use(userRouter)
app.use(notificationsRouter)
app.use(tagsRouter)
app.use(metaRouter)
app.use(searchRouter)

app.get("/", (req, res) => {
  res.send("I'm alive!")
})

// Express' default 404 is an HTML page; clients expect the API's JSON error
app.use((req, res, next) => {
  next(new NotFoundError({ message: `A rota ${req.method} ${req.path} não existe.` }))
})

app.use(errorHandler)

export default app
