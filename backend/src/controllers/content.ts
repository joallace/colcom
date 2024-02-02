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

const getChildrenStats = (topic: any) => {
  let upvotes = 0
  let downvotes = 0

  for (const post of topic.children) {
    upvotes += post.upvotes
    downvotes += post.downvotes
  }

  return { upvotes, downvotes }
}

export const createContent: RequestHandler = async (req, res, next) => {
  const { title, parent_id, body, config } = req.body
  const author_pid = (<any>req.params.user).pid

  try {
    const { parent_id: grandparentId } = !parent_id ?
      { parent_id: null }
      :
      await Content.getDataById(parent_id, ["parent_id"])

    const type = !parent_id ?
      "topic"
      :
      grandparentId ? "critique" : "post"

    const content: ContentInsertRequest = { title, author_pid, parent_id, body, type, config }

    validateContent(content)

    const result = await Content.create(content)

    switch (type) {
      case "topic": {
        const path = `${dbPath}/${result.id}`
        await mkdir(`${path}/critiques`, { recursive: true })
        await Promise.all([writeFile(`${path}/critiques/.gitkeep`, ""), writeFile(`${path}/main.html`, "")])
        await exec("git", ["-C", path, "init", "-b", "main"])
        await exec("git", ["-C", path, "add", "."])
        await exec("git", ["-C", path, "commit", "-m", "init topic"])
        break
      }
      case "post": {
        const path = `${dbPath}/${result.parent_id}`
        const file = `${path}/main.html`
        // Maybe a lock will be needed
        await exec("git", ["-C", path, "checkout", "-b", author_pid])
        await writeFile(file, body)
        await exec("git", ["-C", path, "add", file])
        await exec("git", ["-C", path, "commit", "-m", `init post ${result.id}`])
        break
      }
      case "critique": {
        const path = `${dbPath}/${grandparentId}/critiques`
        const file = `${path}/${result.id}.html`
        await exec("git", ["-C", path, "checkout", author_pid])
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

export const getContentTree: RequestHandler = async (req, res, next) => {
  const page = Number(req.query.page) || 1
  const pageSize = Number(req.query.pageSize) || 10
  const orderBy = req.query.orderBy ? String(req.query.orderBy) : "id"
  const type = req.query.type

  try {
    const contents = await Content.findTree({ page, pageSize, orderBy })

    // Probably doing this the dirtiest way possible, but right now I don't know another way
    // to crop the number of each topic's posts to a certain limit and to count all stats.
    // Also, I still don't have found a way to preserve the sorting from the query when transforming
    // the data into a tree, so since it's just a page I'll sort it again here.
    // Should refactor in the future.
    if (type === "topic") {
      for (const topic of contents) {
        topic.childrenStats = getChildrenStats(topic)
        topic.children = topic.children.slice(0, 3)
      }

      contents.sort((a, b) => {
        if (a.promotions < b.promotions)
          return 1
        else if (a.promotions > b.promotions)
          return -1
        else
          return Number(a.upvotes < b.upvotes)
      })
    }

    res.status(200).json(contents)
  }
  catch (err) {
    next(err)
  }
}

export const getTopicTree: RequestHandler = async (req, res, next) => {
  const id = Number(req.params.id)

  try {
    const topic = (await Content.findTree({ where: "topics.id = $1", values: [id], pageSize: 1 }))[0]

    topic.childrenStats = getChildrenStats(topic)

    res.status(200).json(topic)
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

    res.status(200).json(content)
  }
  catch (err) {
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