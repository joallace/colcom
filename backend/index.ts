import express from "express"
import fs from "fs"
import { execSync } from "child_process"
import { v4 as uuid } from "uuid"

const app = express()
const port = 3000
const dbPath = process.env.DB_PATH || "/db"

const gitLogParameters = `--pretty=format:'{^^^^commit^^^^:^^^^%h^^^^,^^^^subject^^^^:^^^^%s^^^^,^^^^date^^^^:^^^^%aD^^^^,^^^^author^^^^:^^^^%aN^^^^},' | sed 's/"/\\\\"/g' | sed 's/\\^^^^/"/g' | sed "$ s/,$//" | sed -e ':a' -e 'N' -e '$!ba' -e 's/\\n/ /g'  | awk 'BEGIN { print("[") } { print($0) } END { print("]") }'`

app.use(express.json())

app.get("/", (req, res) => {
  res.send("Hello World!")
})

app.get("/topics", (req, res) => {
  const page = req.query.page || 0
  const pageSize = req.query.pageSize || 10
  let result: any = {}

  const topicsIds = fs.readdirSync(dbPath)
  const metaData = JSON.parse(fs.readFileSync(`${dbPath}/[]/meta.json`,  { encoding: "utf-8"}))

  topicsIds.forEach(id => {
    result[id] = {
    }
  })
  
  res.sendStatus(200)
})

app.use("/topics", express.static(dbPath))

app.post("/topics", (req, res) => {
  const { title } = req.body
  const path = `${dbPath}/${title}/`

  const result = execSync(`mkdir "${path}" && git -C "${path}" init && echo $?`, { encoding: "utf-8"})
  const status = result.slice(-2, -1) === "0" ? 201 : 500

  res.sendStatus(status)
})

app.get("/topics/:tid/posts/:pid/history", (req, res) => {
  const path = `${dbPath}/${req.params.tid}/`
  const result = JSON.parse(execSync(`git -C ${path} log ${gitLogParameters}`, { encoding: "utf-8" }))

  res.status(200).json(result)
})

app.post("/topics/:tid/posts", (req, res) => {
  const { content } = req.body
  const path = `${dbPath}/${req.params.tid}/main.html`

  fs.writeFileSync(path, content)
})


app.listen(port, () => {
  console.log(`Listening on port ${port}`)
})

