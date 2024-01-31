import express from "express"
import cors from "cors"
import logger from "@/logger"
import contentRouter from "@/routes/content"
import userRouter from "@/routes/user"
import errorHandler from "@/middleware/errorHandler"

const app = express()
const port = process.env.PORT || 3000

app.use(cors())
app.use(express.json())
app.use(contentRouter)
app.use(userRouter)
app.use(errorHandler)

app.get("/", (req, res) => {
  res.send("I'm alive!")
})

app.listen(port, () => {
  logger.info(`server.ts: Listening on port ${port}`)
})