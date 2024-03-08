import { RequestHandler } from "express"

import git from "@/gitDatabase"
import Content, { ContentInsertRequest } from "@/models/content"
import Interactions from "@/models/interactions"
import { ValidationError, NotFoundError, UnauthorizedError } from "@/errors"


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
    const grandparentId = parent_id ?
      (await Content.getDataById(parent_id, ["parent_id"])).parent_id
      :
      null

    const type = !parent_id ?
      "topic"
      :
      grandparentId ? "critique" : "post"

    const content: ContentInsertRequest = {
      title,
      author_pid,
      parent_id,
      body: type === "post" ? (<any>body)?.match("<p>(.*?)</p>")[1].slice(0, 280) : body,
      type,
      config
    }

    validateContent(content)

    const result = await Content.create(content)
    result.body = body
    await git.create(result)

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
  const getCount = "with_count" in req.query
  const type = req.route.path.slice(1, -1)

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

    res.status(200).json({ tree: contents, count: getCount ? (await Content.getCount("topic")) : undefined })
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
  const omitBody = "omit_body" in req.query
  const includeParentTitle = "include_parent_title" in req.query

  try {
    const content = await Content.findById(content_id, { omitBody, includeParentTitle })

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
      history: content.type === "post" ? await git.log(content) : undefined,
      suggestions: content.type === "post" && author_pid === content.author_id ?
        await Interactions.findAll({
          where: `i.content_id = $1 AND i.type='suggestion' AND i.config->>'accepted' IS NULL`,
          values: [content_id],
          orderBy: "i.id DESC"
        })
        :
        undefined
    })
  }
  catch (err) {
    next(err)
  }
}

export const getVersion: RequestHandler = async (req, res, next) => {
  const content_id = Number(req.params.id)
  const author_pid = (<any>req.params.user)?.pid
  const commit = req.params.hash
  const queryParentId = req.query.parent_id

  try {
    const content = queryParentId ? undefined : await Content.findById(content_id)

    if (!queryParentId) {
      if (!content)
        throw new NotFoundError({
          message: "Conteúdo não encontrado.",
          action: 'Verifique se o "id" fornecido está correto.',
          stack: new Error().stack
        })

      if (content.type !== "post")
        throw new ValidationError({
          message: `Conteúdos do tipo "${content.type}" não podem têm histórico.`,
          action: 'Forneça um "id" de um "post".',
          stack: new Error().stack
        })
    }

    const parent_id = queryParentId || content?.parent_id
    const body = await git.read(Number(parent_id), commit)
    const children = (await Content.findAll({ where: "contents.config->>'commit' = $1", values: [commit] })).reverse()

    for (const child of children)
      (<any>child).userInteractions = (await Interactions.getUserContentInteractions({ author_pid, content_id: child.id })).map(v => v.type)

    res.status(200).json({ body, children })
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

    const interactionId = content.author_id !== author_pid ?
      (await Interactions.create({ author_pid, content_id, type: "suggestion" })).id
      :
      undefined

    const commit = await git.update(content, body, message, interactionId)

    if (interactionId === undefined) {
      const result = await Content.updateById(content.id, body, author_pid)
      res.status(200).json({ ...result, commit })
    }
    else {
      const result = await Interactions.updateById({ id: interactionId, field: "config", config: { message, commit, accepted: null }, author_pid })
      res.status(200).json(result)
    }
  }
  catch (err) {
    next(err)
  }
}

export const clonePost: RequestHandler = async (req, res, next) => {
  const content_id = Number(req.params.id)
  const author_pid = (<any>req.params.user)?.pid
  const commit = req.params.hash
  const { title } = req.body

  try {
    if (!title)
      throw new ValidationError({
        action: 'Forneça um título para o "post".',
        stack: new Error().stack
      })

    const content = await Content.findById(content_id)
    const result = await Content.create({ ...(<any>content), author_pid, title })
    await git.branch(result, commit)

    res.status(200).json(result)
  }
  catch (err) {
    next(err)
  }
}

export const mergePost: RequestHandler = async (req, res, next) => {
  const content_id = Number(req.params.id)
  const author_pid = (<any>req.params.user)?.pid
  const commit = req.params.hash

  try {
    const content = await Content.findById(content_id)

    if(author_pid !== content.author_id)
      throw new UnauthorizedError({
        message: "Somente o autor do post pode realizar merges",
        stack: new Error().stack
      })

    await git.merge(content, commit)
    // TODO: update suggestion interaction to accepted

    res.status(204).end()
  }
  catch (err) {
    next(err)
  }
}