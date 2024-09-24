import { dirname, resolve } from "path"
import { fileURLToPath } from "url"
import { existsSync, mkdirSync } from "fs"
import { writeFile, mkdir } from "fs/promises"
import { promisify } from "util"
import { execFile } from "node:child_process"
import AsyncLock from "async-lock"

import { IContent } from "@/models/content"
import logger from "@/logger"
import { ValidationError } from "./errors"

const exec = promisify(execFile)

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbPath = process.env.DB_PATH || resolve(__dirname, "db/")

if (!existsSync(dbPath)) {
  logger.info(`[gitDatabase.ts] Creating git db at "${dbPath}"`)
  mkdirSync(dbPath)
}
else
  logger.info(`[gitDatabase.ts] Loaded git db at "${dbPath}"`)


async function create(content: IContent, author: any) {
  const { parent_id, id, type, body } = content

  if (type === "critique")
    return

  const repo = parent_id || id
  const path = `${dbPath}/${repo}`
  const file = `${path}/main.html`
  const lock = new AsyncLock()

  lock.acquire(String(repo), async () => {
    if (type === "topic") {
      await mkdir(path)
      await exec("git", ["-C", path, "init", "-b", "main"])
    }
    else
      await exec("git", ["-C", path, "checkout", "-b", String(id), "main"])

    await writeFile(file, body || "")
    await exec("git", ["-C", path, "add", file])
    await exec("git", ["-C", path, "commit", "-m", type === "topic" ? "init topic" : `init post ${id}`, "--author", `${author.username} <${author.email}>`])
  })
}

async function read(repo: number, commit: string) {
  const path = `${dbPath}/${repo}`

  const output = await exec("git", ["-C", path, "show", `${commit}:./main.html`])
  return (output.stdout ?? output)
}

async function update(content: IContent, author: any, body: string, message: string, interactionId: number | undefined) {
  const { parent_id: repo, id } = content
  const path = `${dbPath}/${repo}`
  const file = `${path}/main.html`
  const lock = new AsyncLock()

  return await lock.acquire(String(repo), async () => {
    if (interactionId === undefined)
      await exec("git", ["-C", path, "checkout", String(id)])
    else
      await exec("git", ["-C", path, "checkout", "-b", `${id}_${interactionId}`, String(id)])

    await writeFile(file, body)
    await exec("git", ["-C", path, "add", file])
    await exec("git", ["-C", path, "commit", "-m", message, "--author", `${author.username} <${author.email}>`])

    const output = await exec("git", ["-C", path, "rev-parse", "--short", "HEAD"])
    return (<any>(output.stdout ?? output)).trimEnd()
  })
}

async function branch(content: IContent, commit: string) {
  const { parent_id: repo, id } = content
  const path = `${dbPath}/${repo}`
  const lock = new AsyncLock()

  await lock.acquire(String(repo), async () => {
    await exec("git", ["-C", path, "checkout", "-b", String(id), commit])
  })
}

async function merge(content: IContent, commit: string) {
  const { parent_id: repo, id } = content
  const path = `${dbPath}/${repo}`
  const lock = new AsyncLock()

  await lock.acquire(String(repo), async () => {
    await exec("git", ["-C", path, "checkout", String(id)])
    try {
      await exec("git", ["-C", path, "merge", commit, "--no-ff"])
    } catch (err) {
      await exec("git", ["-C", path, "merge", "--abort"])
      throw new ValidationError({
        message: "Conflito no merge!"
      })
    }
  })
}

async function log(content: IContent) {
  const { parent_id: repo, id } = content

  const path = `${dbPath}/${repo}/`
  const formatFlag = "--pretty=format:{^^^^commit^^^^:^^^^%h^^^^,^^^^subject^^^^:^^^^%s^^^^,^^^^date^^^^:^^^^%aD^^^^,^^^^author^^^^:^^^^%aN^^^^},"

  const output = await exec("git", ["-C", path, "log", `main..${id}`, formatFlag], { encoding: "utf-8" })
  const log: any = output?.stdout ?? output

  return (JSON.parse("[" + log.replaceAll('"', '\\"').replaceAll("^^^^", '"').slice(0, -1) + "]")).reverse()
}

export default Object.freeze({
  create,
  read,
  update,
  branch,
  merge,
  log
})