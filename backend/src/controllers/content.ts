import { RequestHandler } from "express"
import { writeFile, mkdir } from "fs/promises"
import { promisify } from "util"
import { execFile } from "child_process"

import { gitDbPath as dbPath } from "@/database"
import Content, { ContentInsertRequest } from "@/models/content"
import { ValidationError, NotFoundError } from "@/errors"


const exec = promisify(execFile)


const validateContent = (content: ContentInsertRequest) => {
  const mandatory = ["title", "author_pid", ...(content.type === "topic" ? [] : ["parent_id", "body"])]

  for (const field of mandatory)
    if (!content[field])
      throw new ValidationError({
        message: `"${field}" é um campo obrigatório`,
        errorLocationCode: "CONTROLLER:CONTENT:VALIDADE_CONTENT"
      })
}

export const createContent: RequestHandler = async (req, res, next) => {
  const { title, author_pid, parent_id, body, config } = req.body

  try {
    const { type, parent_id: grandparentId } = !parent_id ?
      { type: "topic", parent_id: null }
      :
      await Content.getDataById(parent_id, ["type", "parent_id"])

    const content: ContentInsertRequest = { title, author_pid, parent_id, body, type, config }

    validateContent(content)

    const result = await Content.create(content)

    switch (type) {
      case "topic": {
        const path = `${dbPath}/${result.id}`
        await mkdir(`${path}/critiques`, { recursive: true })
        await writeFile(`${path}/critiques/.gitkeep`, "")
        await writeFile(`${path}/main.html`, "")
        await exec("git", ["-C", path, "init", "-b", "main"])
        await exec("git", ["-C", path, "add", "."])
        await exec("git", ["-C", path, "commit", "-m", "init topic"])
        break
      }
      case "post": {
        const path = `${dbPath}/${result.parent_id}`
        const file = `${path}/main.html`
        // Maybe a lock will be needed
        await exec("git", ["-C", path, "checkout", "-b", result.author_pid])
        await writeFile(file, body)
        await exec("git", ["-C", path, "add", file])
        await exec("git", ["-C", path, "commit", "-m", `init post ${result.id}`])
        break
      }
      case "critique": {
        const path = `${dbPath}/${grandparentId}/critiques`
        const file = `${path}/${result}.html`
        await exec("git", ["-C", path, "checkout", result.author_pid])
        await writeFile(file, body)
        await exec("git", ["-C", path, "add", file])
        await exec("git", ["-C", path, "commit", "-m", `init critique ${result.id}`])
      }
    }

    res.status(201).json(result)
  }
  catch (err) {
    next(err)
  }
}

export const getContents: RequestHandler = async (req, res, next) => {
  const page = Number(req.query.page) || 1
  const pageSize = Number(req.query.pageSize) || 10
  const orderBy = req.query.orderBy ? String(req.query.orderBy) : "id"

  try {
    const contents = await Content.findAll({ page, pageSize, orderBy })
    res.status(200).json(contents)
  }
  catch (err) {
    next(err)
  }
}

export const getContent: RequestHandler = async (req, res, next) => {
  try {
    const content = await Content.findById(Number(req.params.id))

    if (!content)
      throw new NotFoundError({
        message: "Conteúdo não encontrado.",
        action: 'Verifique se o "id" fornecido está correto.',
        stack: new Error().stack
      })

    const path = `${dbPath}/${content.parent_id}/`
    const body = await exec("git", ["-C", path, "show", String(req.query.version) || String(content.parent_id), "./main.html"], { encoding: "utf-8" })

    res.status(200).json({ ...content, body })
  }
  catch(err){
    next(err)
  }
}

export const getContentHistory: RequestHandler = async (req, res, next) => {
  try {
    const content = await Content.findById(Number(req.params.id))

    if (!content)
      throw new NotFoundError({
        message: "Conteúdo não encontrado.",
        action: 'Verifique se o "id" fornecido está correto.',
        stack: new Error().stack
      })

    if (content.type !== "post")
      throw new ValidationError({
        message: `Conteúdos do tipo "${content.type}" não possuem histórico.`,
        action: 'Forneça um "id" de um "post".',
        stack: new Error().stack
      })

    const path = `${dbPath}/${content.parent_id}/`
    const formatFlag = "--pretty=format:{^^^^commit^^^^:^^^^%h^^^^,^^^^subject^^^^:^^^^%s^^^^,^^^^date^^^^:^^^^%aD^^^^,^^^^author^^^^:^^^^%aN^^^^},"

    const log: any = await exec("git", ["-C", path, "log", formatFlag], { encoding: "utf-8" })

    const result = JSON.parse("[" + log.replaceAll('"', '\\"').replaceAll("^^^^", '"').slice(0, -1) + "]")

    res.status(200).json(result)
  }
  catch (err) {
    next(err)
  }
}