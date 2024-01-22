import express from "express"
import logger from "@/logger"
import contentRouter from "@/routes/content"
import userRouter from "@/routes/user"
import errorHandler from "@/middleware/errorHandler"

const app = express()
const port = process.env.PORT || 3000

app.use(function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*")
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept")
    next()
})
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