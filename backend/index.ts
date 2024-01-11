import express from "express"
import { promisify } from "util"
import { readFile, readdir, exists, writeFile, mkdir } from "fs/promises"
import { execFile } from "child_process"
import { v5 as uuid } from "uuid"

const app = express()
const port = process.env.PORT || 3000
const dbPath = process.env.DB_PATH || "/db"
const namespace = process.env.UUID_NAMESPACE || ""

const exec = promisify(execFile)

const logFormattingParam = "--pretty=format:{^^^^commit^^^^:^^^^%h^^^^,^^^^subject^^^^:^^^^%s^^^^,^^^^date^^^^:^^^^%aD^^^^,^^^^author^^^^:^^^^%aN^^^^},"

app.use(express.json())

app.get("/", (req, res) => {
  res.send("I'm alive!")
})

// app.use("/topics", express.static(dbPath))

app.get("/topics", async (req, res) => {
  const page = Number(req.query.page) || 0
  const pageSize = Number(req.query.pageSize) || 10
  let result: any = []

  const topicsIds = await readdir(dbPath)
  for (const id of topicsIds.slice(page, (page + 1) * pageSize))
    result.push(JSON.parse(await readFile(`${dbPath}/${id}/meta.json`, { encoding: "utf-8" })))

  res.status(200).json(result)
})

app.post("/topics", async (req, res) => {
  const { title, tags, synonyms } = req.body
  const id = uuid(title, namespace)
  const path = `${dbPath}/${id}`

  if (await exists(path))
    return res.status(409).send("Topic already exists")

  const metaData = {
    id,
    title,
    tags: tags || [],
    synonyms: synonyms || [],
    up: 0,
    down: 0,
  }

  await mkdir(path)
  await writeFile(`${path}/meta.json`, JSON.stringify(metaData))
  await exec("git", ["-C", path, "init", "-b", "main"])
  await exec("git", ["-C", path, "add", "meta.json"])
  await exec("git", ["-C", path, "commit", "-m", "init topic"])

  res.sendStatus(201)
})

app.get("/topics/:tid/posts/:pid", async (req, res) => {
  const path = `${dbPath}/${req.params.tid}/`
  const result = await exec("git", ["-C", path, "show", String(req.query.version) || req.params.pid, "./main.html"], { encoding: "utf-8" })

  res.status(200).json(result)
})

app.get("/topics/:tid/posts/:pid/history", async (req, res) => {
  const path = `${dbPath}/${req.params.tid}/`
  const log: any = await exec("git", ["-C", path, "log", logFormattingParam], { encoding: "utf-8" })
  const result = JSON.parse("[" + log.replaceAll('"', '\\"').replaceAll("^^^^", '"').slice(0, -1) + "]")

  res.status(200).send(result)
})

app.post("/topics/:tid/posts", async (req, res) => {
  const { content } = req.body
  const path = `${dbPath}/${req.params.tid}/main.html`

  await writeFile(path, content)
})

app.listen(port, () => {
  console.log(`Loaded DB on folder "${dbPath}"`)
  console.log(`Listening on port ${port}`)
})

