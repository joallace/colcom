import { RequestHandler } from "express"
import { writeFile, mkdir } from "fs/promises"
import { promisify } from "util"
import { execFile } from "child_process"

import { gitDbPath as dbPath } from "@/database"
import Content, { ContentInsertRequest } from "@/models/content"
import { ValidationError, NotFoundError } from "@/errors"
import Interactions from "@/models/interactions"


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
  let votes = 0

  for (const post of topic.children) {
    upvotes += post.upvotes
    downvotes += post.downvotes
    votes += post.votes
  }

  return { upvotes, downvotes, votes, count: topic.children.length }
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

    if (type === "topic") {
      const path = `${dbPath}/${result.id}`
      await mkdir(path)
      await writeFile(`${path}/main.html`, "")
      await exec("git", ["-C", path, "init", "-b", "main"])
      await exec("git", ["-C", path, "add", "."])
      await exec("git", ["-C", path, "commit", "-m", "init topic"])
    }

    if (type === "post") {
      const path = `${dbPath}/${result.parent_id}`
      const file = `${path}/main.html`
      // Maybe a lock will be needed
      await exec("git", ["-C", path, "checkout", "-b", String(result.id), "main"])
      await writeFile(file, body)
      await exec("git", ["-C", path, "add", file])
      await exec("git", ["-C", path, "commit", "-m", `init post ${result.id}`])
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
  const author_pid = (<any>req.params.user)?.pid
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
        if (author_pid) {
          topic.userInteractions = (await Interactions.getUserContentInteractions({ author_pid, content_id: topic.id })).map(v => v.type)
          topic.userVote = (await Interactions.getUserTopicVote(author_pid, topic.id))?.content_id
        }
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
  const author_pid = (<any>req.params.user)?.pid
  const id = Number(req.params.id)

  try {
    const topic = (await Content.findTree({ where: "topics.id = $1", values: [id], pageSize: 1 }))[0]

    topic.childrenStats = getChildrenStats(topic)
    if (author_pid) {
      topic.userInteractions = (await Interactions.getUserContentInteractions({ author_pid, content_id: id })).map(v => v.type)
      topic.userVote = (await Interactions.getUserTopicVote(author_pid, id))?.content_id
    }

    res.status(200).json(topic)
  }
  catch (err) {
    next(err)
  }
}

export const getContent: RequestHandler = async (req, res, next) => {
  const author_pid = (<any>req.params.user)?.pid
  const content_id = Number(req.params.id)

  try {
    const content = await Content.findById(content_id)

    if (!content)
      throw new NotFoundError({
        message: "Conteúdo não encontrado.",
        action: 'Verifique se o "id" fornecido está correto.',
        stack: new Error().stack
      })


    const userInteractions = author_pid ? (await Interactions.getUserContentInteractions({ author_pid, content_id })).map(v => v.type) : undefined

    res.status(200).json({
      ...content,
      userInteractions,
      history: content.type === "post" ? await getPostHistory(content.id, Number(content.parent_id)) : undefined
    })
  }
  catch (err) {
    next(err)
  }
}

export const getVersion: RequestHandler = async (req, res, next) => {
  const content_id = Number(req.params.id)
  const commit = req.params.hash

  try {
    const content = await Content.findById(content_id)

    if (!content)
      throw new NotFoundError({
        message: "Conteúdo não encontrado.",
        action: 'Verifique se o "id" fornecido está correto.',
        stack: new Error().stack
      })

    const path = `${dbPath}/${content.parent_id}`
    const result = await exec("git", ["-C", path, "show", `${commit}:./main.html`])

    res.status(200).send(result)
  }
  catch (err) {
    next(err)
  }
}

export const updateContent: RequestHandler = async (req, res, next) => {
  const author_pid = (<any>req.params.user).pid
  const content_id = Number(req.params.id)
  const { message, body } = req.body

  try {
    const content = await Content.findById(content_id)

    if (!content)
      throw new NotFoundError({
        message: "Conteúdo não encontrado.",
        action: 'Verifique se o "id" fornecido está correto.',
        stack: new Error().stack
      })

    if (content.type !== "post")
      throw new ValidationError({
        message: `Conteúdos do tipo "${content.type}" não podem ser alterados.`,
        action: 'Forneça um "id" de um "post".',
        stack: new Error().stack
      })

    const path = `${dbPath}/${content.parent_id}`
    const file = `${path}/main.html`

    if (content.author_id === author_pid) {
      await exec("git", ["-C", path, "checkout", String(content.id)])
      await writeFile(file, body)
      await exec("git", ["-C", path, "add", file])
      await exec("git", ["-C", path, "commit", "-m", message])

      const result = await Content.updateById(content.id, body, author_pid)
      res.status(200).json(result)
    }
    else {
      await exec("git", ["-C", path, "checkout", "-b", `${content.id}/${author_pid}`, String(content.id)])
      await writeFile(file, body)
      await exec("git", ["-C", path, "add", file])
      await exec("git", ["-C", path, "commit", "-m", message])

      res.status(204).end()
    }
  }
  catch (err) {
    next(err)
  }
}

const getPostHistory = async (post_id: number, parent_id: number) => {
  const path = `${dbPath}/${parent_id}/`
  const formatFlag = "--pretty=format:{^^^^commit^^^^:^^^^%h^^^^,^^^^subject^^^^:^^^^%s^^^^,^^^^date^^^^:^^^^%ar^^^^,^^^^author^^^^:^^^^%aN^^^^},"

  const log: any = await exec("git", ["-C", path, "log", `main..${post_id}`, formatFlag], { encoding: "utf-8" })

  return (JSON.parse("[" + log.replaceAll('"', '\\"').replaceAll("^^^^", '"').slice(0, -1) + "]")).reverse()
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

    const result = getPostHistory(content.id, Number(content.parent_id))

    res.status(200).json(result)
  }
  catch (err) {
    next(err)
  }
}