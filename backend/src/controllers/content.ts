import { RequestHandler } from "express"

import git from "@/gitDatabase"
import Content, { ContentInsertRequest, ContentType, IContent, ListedContent } from "@/models/content"
import Interactions from "@/models/interactions"
import { notify } from "@/models/notifications"
import { ValidationError, NotFoundError, ForbiddenError } from "@/errors"
import { validate } from "@/validation"
import { applyTopicTags, prepareTopicTags, resolveFilter, splitSlugs } from "@/controllers/tags"
import Tags from "@/models/tags"
import logger from "@/logger"


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
      errorLocationCode: "CONTROLLER:CONTENT:VALIDATE_CRITIQUE_COMMIT:FOREIGN_COMMIT",
      key: "config.commit"
    })
}

// A post defends one of its topic's answers; a topic without answers leaves them open
const validateAnswer = (answers: string[], answer: string | undefined) => {
  if (answers.length > 0 && !answers.includes(answer ?? ""))
    throw new ValidationError({
      message: "Resposta: escolha uma das respostas do tópico.",
      action: `Utilize um dos valores: ${answers.join(", ")}.`,
      errorLocationCode: "CONTROLLER:CONTENT:VALIDATE_ANSWER",
      key: "config.answer"
    })
}

const NOT_FOUND = {
  topic: "Tópico não encontrado.",
  post: "Post não encontrado.",
  critique: "Crítica não encontrada.",
  any: "Conteúdo não encontrado."
}

// The 404 for an id from the URL; a content of another type than the route serves is as missing
export const contentNotFound = (type?: ContentType) => new NotFoundError({
  message: NOT_FOUND[type ?? "any"],
  action: 'Verifique se o "id" fornecido está correto.'
})

export async function findContentOrThrow<T extends ContentType = ContentType>(id: number, type?: T, options?: { omitBody?: boolean, includeParentTitle?: boolean }) {
  const content = await Content.findById(id, options)

  if (!content || (type && content.type !== type))
    throw contentNotFound(type)

  return content as Extract<ListedContent, { type: T }>
}

const findOwnedSuggestion = async (content_id: number, commit: string, author_pid: string) => {
  const content = await findContentOrThrow(content_id, "post")

  if (author_pid !== content.author_id)
    throw new ForbiddenError({
      message: "Somente o autor do post pode aceitar ou rejeitar sugestões."
    })

  const suggestion = await Interactions.findPendingSuggestion(content_id, commit)

  if (!suggestion)
    throw new NotFoundError({
      message: "Sugestão pendente não encontrada para este post.",
      action: 'Verifique se o "hash" fornecido está correto.'
    })

  return { content, suggestion }
}

// Turns a page of mixed contents (a profile, the bookmarks) into what each type needs to be shown
// on its own: topics with their posts, posts with the topic they answer, critiques with the post
// they criticise. `contents` must come from findAll with includeParentTitle.
export const toFeed = async (contents: ListedContent[], author_pid?: string) => {
  const topicIds = contents.filter(content => content.type === "topic").map(content => content.id)
  const trees = topicIds.length > 0 ?
    await Content.findTopicsByIds(topicIds, { childLimit: TOPIC_PREVIEW_POSTS, userPid: author_pid })
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

// A list's total comes with its page (total_count). Only a page past the end, which has no
// rows to carry it, needs the count queried on its own.
export const totalOf = async (contents: ListedContent[], page: number, countAlone: () => Promise<number>) =>
  contents[0]?.total_count ?? (page > 1 ? await countAlone() : 0)

export const createContent: RequestHandler = async (req, res) => {
  const author_pid = res.locals.user.pid

  const { parent_id } = validate("content", req.body)
  const parent = parent_id ? await Content.getFieldsOrThrow(parent_id, ["type", "config"]) : null

  // The type follows from the parent: none for a topic, a topic for a post, a post for a critique
  let content: ContentInsertRequest
  let preparedTags: Awaited<ReturnType<typeof prepareTopicTags>> | undefined

  if (!parent) {
    const { title, body, config, tags } = validate("topic", req.body)
    // Checked before anything is written; written once the topic exists, as the tag log can't be
    // rolled back
    preparedTags = await prepareTopicTags(tags, author_pid)
    content = { type: "topic", title, body, config, author_pid }
  }
  else if (parent.type === "topic") {
    const { title, parent_id, body, config } = validate("post", req.body)
    validateAnswer(parent.config.answers, config.answer)
    content = { type: "post", title, parent_id, body, config, author_pid }
  }
  // Answers to a critique belong to its lifecycle (address, rebut, dispute), not to nested critiques
  else if (parent.type === "critique")
    throw new ValidationError({
      message: "Somente posts podem ser criticados.",
      errorLocationCode: "CONTROLLER:CONTENT:CREATE_CONTENT:CRITIQUE_PARENT",
      key: "parent_id"
    })
  else {
    const { title, parent_id, body, config } = validate("critique", req.body)
    await validateCritiqueCommit(await findContentOrThrow(parent_id, "post"), config.commit)
    content = { type: "critique", title, parent_id, body, config, author_pid }
  }

  // Posts keep only a summary in Postgres; git and the response get the whole text
  const { type, body } = content
  const result = { ...(await Content.create(content)), body }
  await withRollback(() => git.create(result, res.locals.user), () => Content.removeById(result.id))

  if (preparedTags) {
    // The topic is there either way: a tag that fails (a race on the daily limit) isn't worth losing it
    try {
      await applyTopicTags(result.id, preparedTags, author_pid)
    }
    catch (err) {
      logger.error(err, `[content.ts] Failed to tag topic ${result.id}`)
    }
  }

  // A critique is news for the post's author, a post for the topic's
  if (type !== "topic")
    await notify({ type, actor_pid: author_pid, content_id: content.parent_id, subject_id: result.id })

  res.status(201).json(preparedTags ? { ...result, tags: await Tags.ofTopic(result.id, author_pid) } : result)
}

export const getContents: RequestHandler = async (req, res) => {
  const author_pid = res.locals.user?.pid

  const { page, pageSize, orderBy, authorId } = validate("list", req.query)

  const contents = await Content.findList({ authorPid: authorId, page, pageSize, orderBy, userPid: author_pid })
  const count = await totalOf(contents, page, () => Content.countList({ authorPid: authorId }))
  res.status(200).json({ contents: await toFeed(contents, author_pid), count })
}

export const getContentTree: RequestHandler = async (req, res) => {
  const author_pid = res.locals.user?.pid
  const getCount = "with_count" in req.query

  const { page, pageSize, orderBy, tags: slugs } = validate("list", req.query)

  // Topics showing all of these tags; none when one of them doesn't exist
  const tags = slugs ? await resolveFilter(splitSlugs(slugs)) : undefined
  if (tags === null) {
    res.status(200).json({ tree: [], count: getCount ? 0 : undefined })
    return
  }

  const tagIds = tags?.map(tag => tag.id)
  const contents = await Content.findTopics({ tagIds, page, pageSize, orderBy, childLimit: TOPIC_PREVIEW_POSTS, userPid: author_pid })
  const count = getCount ? await Content.countTopics({ tagIds }) : undefined
  res.status(200).json({ tree: contents, count })
}

export const getTopicTree: RequestHandler = async (req, res) => {
  const author_pid = res.locals.user?.pid

  const { id } = validate("contentParams", req.params)
  const topic = await Content.findTopic(id, author_pid)

  if (!topic)
    throw contentNotFound("topic")

  res.status(200).json(topic)
}

export const getContent: RequestHandler = async (req, res) => {
  const author_pid = res.locals.user?.pid
  const omitBody = "omit_body" in req.query
  const includeParentTitle = "include_parent_title" in req.query

  const { id: content_id } = validate("contentParams", req.params)
  const content = await findContentOrThrow(content_id, undefined, { omitBody, includeParentTitle })

  const userInteractions = author_pid ? (await Interactions.getUserContentInteractions(author_pid, content_id)).map(v => v.type) : undefined

  res.status(200).json({
    ...content,
    userInteractions,
    history: content.type === "post" ? await git.log(content) : undefined,
    interactionCounts: content.type === "post" ? await Content.interactionCounts(content_id) : undefined,
    // The post the viewer voted for in this post's topic (null for none), so the page can tell whether
    // their vote here is new to the poll or moved from another post
    userTopicVote: content.type === "post" && author_pid ?
      (await Interactions.getUserTopicVote(author_pid, content.parent_id))?.content_id ?? null
      :
      undefined,
    suggestions: content.type === "post" && author_pid === content.author_id ?
      await Interactions.pendingSuggestions(content_id)
      :
      undefined
  })
}

export const getBookmarkedContent: RequestHandler = async (req, res) => {
  const author_pid = res.locals.user.pid

  const { page, pageSize } = validate("list", req.query)
  const contents = await Content.findBookmarked(author_pid, { page, pageSize })
  const count = await totalOf(contents, page, () => Content.countBookmarked(author_pid))

  res.status(200).json({ contents: await toFeed(contents, author_pid), count })
}

export const getVersion: RequestHandler = async (req, res) => {
  const author_pid = res.locals.user?.pid

  const { id: content_id, hash: commit } = validate("versionParams", req.params)
  const content = await findContentOrThrow(content_id)

  if (content.type !== "post")
    throw new ValidationError({
      message: `Conteúdos do tipo "${content.type}" não têm histórico.`,
      action: 'Forneça um "id" de um "post".'
    })

  const repo = Number(content.parent_id)
  const body = await git.read(repo, commit)

  // The version may also be a pending suggestion, which descends from the post's history too
  const versionAncestors = await git.ancestors(repo, commit)
  const critiques = (await Content.critiquesOf(content_id, author_pid))
    .filter(critique => versionAncestors.has(critique.config.commit))

  // For each earlier version critiques were made on, the versions from it to this one, along the
  // post's line of history, and their texts. The client follows each passage through every edit
  // in order, so a passage removed at some point stays removed, whatever text comes later.
  const history = (await git.firstParentHistory(repo, commit)).reverse()
  const lineages: Record<string, string[]> = {}
  const versions: Record<string, string> = {}

  for (const critiqueCommit of new Set(critiques.map(critique => critique.config.commit))) {
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

export const updateContent: RequestHandler = async (req, res) => {
  const author_pid = res.locals.user.pid

  const { id: content_id } = validate("contentParams", req.params)
  const { message, body } = validate("edit", req.body)
  const content = await findContentOrThrow(content_id)

  if (content.type !== "post")
    throw new ValidationError({
      message: `Conteúdos do tipo "${content.type}" não podem ser alterados.`,
      action: 'Forneça um "id" de um "post".'
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
    const result = await Interactions.setSuggestionCommit(interactionId, { message, commit }, author_pid)
    await notify({ type: "suggestion", actor_pid: author_pid, content_id, interaction_id: interactionId })
    res.status(200).json(result)
  }
}

export const clonePost: RequestHandler = async (req, res) => {
  const author_pid = res.locals.user?.pid

  const { id: content_id, hash: commit } = validate("versionParams", req.params)
  const { title } = validate("clone", req.body)
  const content = await findContentOrThrow(content_id, "post")

  const created = await Content.create({ type: "post", title, author_pid, parent_id: content.parent_id, config: content.config })
  await withRollback(() => git.branch(created, commit), () => Content.removeById(created.id))
  // The branch checked the version exists; its text, not the post's latest, is the clone's
  const { body } = await Content.updateById(created.id, await git.read(Number(content.parent_id), commit), author_pid)
  const result = { ...created, body }
  await notify({ type: "clone", actor_pid: author_pid, content_id, subject_id: result.id })

  res.status(200).json(result)
}

export const mergePost: RequestHandler = async (req, res) => {
  const author_pid = res.locals.user?.pid

  const { id: content_id, hash: commit } = validate("versionParams", req.params)
  // A body is the author's resolution of the conflicts (see getMergeSides); without one, the merge is automatic
  const resolution = req.body && Object.keys(req.body).length > 0 ? validate("resolution", req.body) : undefined
  const { content, suggestion } = await findOwnedSuggestion(content_id, commit, author_pid)

  const merged = await git.merge(content, commit, resolution)
  await Content.updateById(content.id, await git.read(Number(content.parent_id), merged), author_pid)
  await Interactions.setSuggestionAccepted(suggestion.id, true, author_pid)
  await notify({ type: "suggestion_accepted", actor_pid: author_pid, content_id, interaction_id: suggestion.id })

  res.status(204).end()
}

// What the author needs to resolve a suggestion that conflicts with the post: the post as it is
// (`head`, whose commit goes back with the resolution), the suggestion, and the version it was made on
export const getMergeSides: RequestHandler = async (req, res) => {
  const author_pid = res.locals.user?.pid

  const { id: content_id, hash: commit } = validate("versionParams", req.params)
  const { content } = await findOwnedSuggestion(content_id, commit, author_pid)

  res.status(200).json(await git.mergeSides(content, commit))
}

export const rejectSuggestion: RequestHandler = async (req, res) => {
  const author_pid = res.locals.user?.pid

  const { id: content_id, hash: commit } = validate("versionParams", req.params)
  const { suggestion } = await findOwnedSuggestion(content_id, commit, author_pid)
  const result = await Interactions.setSuggestionAccepted(suggestion.id, false, author_pid)
  await notify({ type: "suggestion_rejected", actor_pid: author_pid, content_id, interaction_id: suggestion.id })

  res.status(200).json(result)
}
