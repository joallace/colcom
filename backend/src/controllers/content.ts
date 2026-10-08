import { RequestHandler } from "express"

import git from "@/gitDatabase"
import Content, { ContentInsertRequest, IContent, summarize } from "@/models/content"
import Interactions from "@/models/interactions"
import { notify } from "@/models/notifications"
import { ValidationError, NotFoundError, ForbiddenError } from "@/errors"
import { validate } from "@/validation"


// Postgres and git can't share a transaction, so when the git write fails the row that was
// just inserted is removed, instead of being left pointing to a missing branch or repo.
const withRollback = async (gitWrite: () => Promise<unknown>, rollback: () => Promise<unknown>) => {
  try {
    await gitWrite()
  }
  catch (err) {
    await rollback()
    throw err
  }
}

// How many of a topic's posts lists show (the most voted); the topic's own page shows them all
const TOPIC_PREVIEW_POSTS = 3

// The schemas check a critique's shape (shared/); only git knows whether the version it quotes is
// part of the post's own history
const validateCritiqueCommit = async (post: IContent, commit: string) => {
  if (!(await git.isInHistory(post, commit)))
    throw new ValidationError({
      message: "A versão criticada não pertence a este post.",
      stack: new Error().stack,
      errorLocationCode: "CONTROLLER:CONTENT:VALIDATE_CRITIQUE_COMMIT:FOREIGN_COMMIT",
      key: "config.commit"
    })
}

// A post defends one of its topic's answers; a topic without answers leaves them open
const validateAnswer = (topicConfig: any, answer: string | undefined) => {
  const answers: string[] = topicConfig?.answers ?? []

  if (answers.length > 0 && !answers.includes(answer ?? ""))
    throw new ValidationError({
      message: "Resposta: escolha uma das respostas do tópico.",
      action: `Utilize um dos valores: ${answers.join(", ")}.`,
      stack: new Error().stack,
      errorLocationCode: "CONTROLLER:CONTENT:VALIDATE_ANSWER",
      key: "config.answer"
    })
}

const findOwnedSuggestion = async (content_id: number, commit: string, author_pid: string) => {
  const content = await Content.findById(content_id)

  if (!content || content.type !== "post")
    throw new NotFoundError({
      message: "Post não encontrado.",
      action: 'Verifique se o "id" fornecido está correto.',
      stack: new Error().stack
    })

  if (author_pid !== content.author_id)
    throw new ForbiddenError({
      message: "Somente o autor do post pode aceitar ou rejeitar sugestões.",
      stack: new Error().stack
    })

  const suggestion = await Interactions.findPendingSuggestion(content_id, commit)

  if (!suggestion)
    throw new NotFoundError({
      message: "Sugestão pendente não encontrada para este post.",
      action: 'Verifique se o "hash" fornecido está correto.',
      stack: new Error().stack
    })

  return { content, suggestion }
}

// Turns a page of mixed contents (a profile, the bookmarks) into what each type needs to be shown
// on its own: topics with their posts, posts with the topic they answer, critiques with the post
// they criticise. `contents` must come from findAll with includeParentTitle.
const toFeed = async (contents: any[], author_pid?: string) => {
  const topicIds = contents.filter(content => content.type === "topic").map(content => content.id)
  const trees = topicIds.length > 0 ?
    await Content.findTree({ where: "topics.id = ANY($1::int[])", values: [topicIds], pageSize: topicIds.length, childLimit: TOPIC_PREVIEW_POSTS, userPid: author_pid })
    :
    []
  const treeById = new Map(trees.map(tree => [tree.id, tree]))

  return contents.map(({ parent_title, grandparent_id, total_count, ...content }) => {
    if (content.type === "topic")
      return treeById.get(content.id) ?? content
    if (content.type === "post")
      return { ...content, topic: { id: content.parent_id, title: parent_title } }
    return { ...content, post: { id: content.parent_id, title: parent_title }, topic: { id: grandparent_id } }
  })
}

// A list's total comes with its page (findAll's withTotal). Only a page past the end, which has no
// rows to carry it, needs the count queried on its own.
const totalOf = async (contents: any[], page: number, countAlone: () => Promise<number>) =>
  contents[0]?.total_count ?? (page > 1 ? await countAlone() : 0)

export const createContent: RequestHandler = async (req, res, next) => {
  const author_pid = res.locals.user.pid

  try {
    const { parent_id } = validate("content", req.body)
    const parent = parent_id ? await Content.getDataById(parent_id, ["parent_id", "type", "config"]) : null

    const type = !parent ?
      "topic"
      :
      parent.parent_id ? "critique" : "post"

    // Answers to a critique belong to its lifecycle (address, rebut, dispute), not to nested critiques
    if (type === "critique" && parent.type !== "post")
      throw new ValidationError({
        message: "Somente posts podem ser criticados.",
        stack: new Error().stack,
        errorLocationCode: "CONTROLLER:CONTENT:CREATE_CONTENT:CRITIQUE_PARENT",
        key: "parent_id"
      })

    const { title, body, config } = validate(type, req.body)

    if (type === "post")
      validateAnswer(parent.config, (<any>config).answer)

    if (type === "critique")
      await validateCritiqueCommit(<IContent>await Content.findById(<number>parent_id), (<any>config).commit)

    const content: ContentInsertRequest = {
      title,
      author_pid,
      parent_id,
      body: type === "post" ? summarize(<string>body) : body,
      type,
      config
    }

    const result = await Content.create(content)
    result.body = body
    await withRollback(() => git.create(result, res.locals.user), () => Content.removeById(result.id))

    // A critique is news for the post's author, a post for the topic's
    if (type !== "topic")
      await notify({ type, actor_pid: author_pid, content_id: <number>parent_id, subject_id: result.id })

    res.status(201).json(result)
  }
  catch (err) {
    next(err)
  }
}

export const getContents: RequestHandler = async (req, res, next) => {
  const author_pid = res.locals.user?.pid

  try {
    const { page, pageSize, orderBy, authorId } = validate("list", req.query)
    const where = authorId ? {
      where: "users.pid = $1",
      values: [authorId]
    } : {}

    const contents = await Content.findAll({ page, pageSize, orderBy, includeParentTitle: true, userPid: author_pid, withTotal: true, ...where })
    const count = await totalOf(contents, page, () => Content.count(where))
    res.status(200).json({ contents: await toFeed(contents, author_pid), count })
  }
  catch (err) {
    next(err)
  }
}

export const getContentTree: RequestHandler = async (req, res, next) => {
  const author_pid = res.locals.user?.pid
  const getCount = "with_count" in req.query

  try {
    const { page, pageSize, orderBy } = validate("list", req.query)
    const contents = await Content.findTree({ page, pageSize, orderBy, childLimit: TOPIC_PREVIEW_POSTS, userPid: author_pid })
    res.status(200).json({ tree: contents, count: getCount ? (await Content.getCount("topic")) : undefined })
  }
  catch (err) {
    next(err)
  }
}

export const getTopicTree: RequestHandler = async (req, res, next) => {
  const author_pid = res.locals.user?.pid

  try {
    const { id } = validate("contentParams", req.params)
    const [topic] = await Content.findTree({ where: "topics.id = $1 AND topics.type = 'topic'", values: [id], pageSize: 1, userPid: author_pid })

    if (!topic)
      throw new NotFoundError({
        message: "Tópico não encontrado.",
        action: 'Verifique se o "id" fornecido está correto.',
        stack: new Error().stack
      })

    res.status(200).json(topic)
  }
  catch (err) {
    next(err)
  }
}

export const getContent: RequestHandler = async (req, res, next) => {
  const author_pid = res.locals.user?.pid
  const omitBody = "omit_body" in req.query
  const includeParentTitle = "include_parent_title" in req.query

  try {
    const { id: content_id } = validate("contentParams", req.params)
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

export const getBookmarkedContent: RequestHandler = async (req, res, next) => {
  const author_pid = res.locals.user?.pid

  try {
    const { page, pageSize } = validate("list", req.query)
    const contents = await Content.findAll({
      where: `
      contents.id IN (
        SELECT
          content_id AS id
        FROM
          interactions
        INNER JOIN
          users ON users.id = interactions.author_id
        WHERE
          interactions.type = 'bookmark'
        AND
          users.pid = $1
      )
      `,
      values: [author_pid],
      page,
      pageSize,
      includeParentTitle: true,
      userPid: author_pid,
      withTotal: true
    })

    const count = await totalOf(contents, page, () =>
      Interactions.getCount(`interactions.type = 'bookmark' AND users.pid = $1`, [author_pid], "INNER JOIN users ON users.id = interactions.author_id"))

    res.status(200).json({ contents: await toFeed(contents, author_pid), count })
  }
  catch (err) {
    next(err)
  }
}

export const getVersion: RequestHandler = async (req, res, next) => {
  const author_pid = res.locals.user?.pid

  try {
    const { id: content_id, hash: commit } = validate("versionParams", req.params)
    const content = await Content.findById(content_id)

    if (!content)
      throw new NotFoundError({
        message: "Conteúdo não encontrado.",
        action: 'Verifique se o "id" fornecido está correto.',
        stack: new Error().stack
      })

    if (content.type !== "post")
      throw new ValidationError({
        message: `Conteúdos do tipo "${content.type}" não têm histórico.`,
        action: 'Forneça um "id" de um "post".',
        stack: new Error().stack
      })

    const repo = Number(content.parent_id)
    const body = await git.read(repo, commit)

    // The version may also be a pending suggestion, which descends from the post's history too
    const versionAncestors = await git.ancestors(repo, commit)
    const critiques = (await Content.findAll({
      where: "contents.parent_id = $1 AND contents.type = 'critique'",
      values: [content_id],
      paginate: false,
      userPid: author_pid
    }))
      .filter(critique => versionAncestors.has((<any>critique.config)?.commit))
      .reverse()

    // For each earlier version critiques were made on, the versions from it to this one, along the
    // post's line of history, and their texts. The client follows each passage through every edit
    // in order, so a passage removed at some point stays removed, whatever text comes later.
    const history = (await git.firstParentHistory(repo, commit)).reverse()
    const lineages: Record<string, string[]> = {}
    const versions: Record<string, string> = {}

    for (const critiqueCommit of new Set(critiques.map(critique => String((<any>critique.config).commit)))) {
      if (critiqueCommit === commit)
        continue

      // A critique made off this line (e.g. on a merged suggestion's own commit) is compared directly
      const start = history.indexOf(critiqueCommit)
      lineages[critiqueCommit] = start === -1 ? [critiqueCommit, commit] : history.slice(start)

      for (const version of lineages[critiqueCommit])
        if (version !== commit && versions[version] === undefined)
          versions[version] = await git.read(repo, version)
    }

    // A pending suggestion also comes with the version it was made on, to show what it changes
    const isSuggestion = Boolean(await Interactions.findPendingSuggestion(content_id, commit))
    const baseCommit = isSuggestion ? await git.mergeBase(content, commit) : undefined
    const base = baseCommit ? { commit: baseCommit, body: await git.read(repo, baseCommit) } : undefined

    res.status(200).json({ body, critiques, versions, lineages, base })
  }
  catch (err) {
    next(err)
  }
}

export const updateContent: RequestHandler = async (req, res, next) => {
  const author_pid = res.locals.user.pid

  try {
    const { id: content_id } = validate("contentParams", req.params)
    const { message, body } = validate("edit", req.body)
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

    let commit
    try {
      commit = await git.update(content, res.locals.user, body, message, interactionId)
    }
    catch (err) {
      if (interactionId !== undefined)
        await Interactions.removeById(interactionId)
      throw err
    }

    if (interactionId === undefined) {
      const result = await Content.updateById(content.id, body, author_pid)
      res.status(200).json({ ...result, commit })
    }
    else {
      const result = await Interactions.updateById({ id: interactionId, field: "config", config: { message, commit, accepted: null }, author_pid })
      await notify({ type: "suggestion", actor_pid: author_pid, content_id, interaction_id: interactionId })
      res.status(200).json(result)
    }
  }
  catch (err) {
    next(err)
  }
}

export const clonePost: RequestHandler = async (req, res, next) => {
  const author_pid = res.locals.user?.pid

  try {
    const { id: content_id, hash: commit } = validate("versionParams", req.params)
    const { title } = validate("clone", req.body)
    const content = await Content.findById(content_id)

    if (!content || content.type !== "post")
      throw new NotFoundError({
        message: "Post não encontrado.",
        action: 'Verifique se o "id" fornecido está correto.',
        stack: new Error().stack
      })

    const result = await Content.create({ ...(<any>content), author_pid, title })
    await withRollback(() => git.branch(result, commit), () => Content.removeById(result.id))
    await notify({ type: "clone", actor_pid: author_pid, content_id, subject_id: result.id })

    res.status(200).json(result)
  }
  catch (err) {
    next(err)
  }
}

export const mergePost: RequestHandler = async (req, res, next) => {
  const author_pid = res.locals.user?.pid

  try {
    const { id: content_id, hash: commit } = validate("versionParams", req.params)
    const { content, suggestion } = await findOwnedSuggestion(content_id, commit, author_pid)

    await git.merge(content, commit)
    await Interactions.setSuggestionAccepted(suggestion.id, true, author_pid)
    await notify({ type: "suggestion_accepted", actor_pid: author_pid, content_id, interaction_id: suggestion.id })

    res.status(204).end()
  }
  catch (err) {
    next(err)
  }
}

export const rejectSuggestion: RequestHandler = async (req, res, next) => {
  const author_pid = res.locals.user?.pid

  try {
    const { id: content_id, hash: commit } = validate("versionParams", req.params)
    const { suggestion } = await findOwnedSuggestion(content_id, commit, author_pid)
    const result = await Interactions.setSuggestionAccepted(suggestion.id, false, author_pid)
    await notify({ type: "suggestion_rejected", actor_pid: author_pid, content_id, interaction_id: suggestion.id })

    res.status(200).json(result)
  }
  catch (err) {
    next(err)
  }
}
