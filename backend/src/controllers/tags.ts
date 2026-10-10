import { RequestHandler } from "express"
import { tagSlug } from "@colcom/shared"

import config from "@/config"
import Content from "@/models/content"
import Tags, { ResolvedTag, Voter } from "@/models/tags"
import { ForbiddenError, NotFoundError, TooManyRequestsError, ValidationError } from "@/errors"
import { limits, validate } from "@/validation"


const DAY = 86_400_000

const oldEnough = (user: Voter) => Date.now() - new Date(user.created_at).getTime() >= config.tags.minAccountDays * DAY

const plural = (count: number, singular: string, plural: string) => `${count} ${count === 1 ? singular : plural}`

// Creating tags is what's limited (using them is free): new accounts can't, and nobody can create
// more than a few a day
const assertCanCreate = async (user: Voter, count: number) => {
  if (!oldEnough(user))
    throw new ForbiddenError({
      message: `Contas com menos de ${plural(config.tags.minAccountDays, "dia", "dias")} não podem criar tags.`,
      action: "Use uma das tags existentes, ou espere alguns dias."
    })

  if (await Tags.createdToday(user.id) + count > config.tags.createPerDay)
    throw new TooManyRequestsError({
      message: `Cada pessoa pode criar até ${plural(config.tags.createPerDay, "tag", "tags")} por dia.`,
      action: "Use uma das tags existentes, ou tente novamente amanhã."
    })
}

const expired = (tag: ResolvedTag, key: string) => new ValidationError({
  message: `A tag "${tag.name}" expirou, pois poucos tópicos a usaram.`,
  action: "Escolha outra tag.",
  key
})

// Only the instance applies a reserved tag (src/meta.ts). The field's key lets the topic form show
// it on the tag
const reserved = (tag: ResolvedTag, key: string) => new ForbiddenError({
  message: `A tag "${tag.name}" é reservada aos tópicos fundamentais do colcom.`,
  action: "Escolha outra tag.",
  key
})

const notATopic = () => new ValidationError({
  message: "Somente tópicos têm tags.",
  errorLocationCode: "CONTROLLER:TAGS:NOT_A_TOPIC"
})

export interface PreparedTags {
  ids: number[],
  missing: { slug: string, name: string }[]
}

// A new topic's tags, checked before the topic is written: names with one slug are one tag, aliases
// stand for their tag, expired ones are refused and creating the missing ones must be allowed.
// Nothing is written yet.
export async function prepareTopicTags(names: string[], authorPid: string): Promise<PreparedTags> {
  const bySlug = new Map<string, string>()
  for (const name of names)
    if (!bySlug.has(tagSlug(name)))
      bySlug.set(tagSlug(name), name.trim())

  const found = await Tags.resolve([...bySlug.keys()])
  const ids = new Set<number>()
  const missing = []

  for (const [index, [slug, name]] of [...bySlug].entries()) {
    const tag = found.get(slug)
    if (!tag)
      missing.push({ slug, name })
    else if (tag.expired)
      throw expired(tag, `tags.${index}`)
    else if (tag.reserved)
      throw reserved(tag, `tags.${index}`)
    else
      ids.add(tag.id)
  }

  if (missing.length > 0)
    await assertCanCreate(await Tags.voter(authorPid), missing.length)

  return { ids: [...ids], missing }
}

// Once the topic exists: creates the missing tags and endorses every one in the author's name
export async function applyTopicTags(topicId: number, { ids, missing }: PreparedTags, authorPid: string) {
  const author = await Tags.voter(authorPid)
  const created = []
  for (const { slug, name } of missing)
    created.push(await Tags.create(slug, name, author.id))

  for (const id of new Set([...ids, ...created])) {
    await Tags.vote(topicId, id, author.id, 1)
    await Tags.activate(id)
  }
}

// The tags of a filter, aliases replaced by their tag; null when some tag doesn't exist (or expired),
// since then no topic can have them all
export async function resolveFilter(slugs: string[]): Promise<ResolvedTag[] | null> {
  const found = await Tags.resolve(slugs)
  const tags = slugs.map(slug => found.get(slug))

  if (tags.some(tag => !tag || tag.expired))
    return null

  // An alias and its tag are one tag
  return tags.filter((tag, index) => tags.findIndex(other => other!.id === tag!.id) === index) as ResolvedTag[]
}

export const splitSlugs = (slugs: string) => slugs.split(",")

export const voteOnTag: RequestHandler = async (req, res) => {
  const pid = res.locals.user.pid

  const { id } = validate("contentParams", req.params)
  const { tag: name, value } = validate("tagVote", req.body)
  const topic = await Content.getFieldsOrThrow(id, ["type", "author_id"])

  if (topic.type !== "topic")
    throw notATopic()

  const user = await Tags.voter(pid)

  // A topic's author curates its tags from the start; everyone else once out of probation
  if (user.id !== topic.author_id && !oldEnough(user))
    throw new ForbiddenError({
      message: `Contas com menos de ${plural(config.tags.minAccountDays, "dia", "dias")} só podem votar nas tags dos próprios tópicos.`
    })

  const slug = tagSlug(name)
  let tag = (await Tags.resolve([slug])).get(slug)
  const proposed = await Tags.proposed(id)

  if (tag?.expired)
    throw expired(tag, "tag")

  // Neither proposed, endorsed nor contested: it stays exactly where the instance put it
  if (tag?.reserved)
    throw reserved(tag, "tag")

  if (value !== 1 && (!tag || !proposed.has(tag.id)))
    throw new ValidationError({
      message: "Esta tag não foi proposta para este tópico.",
      action: "Para propor uma tag, apoie-a.",
      key: "tag"
    })

  if (value === 1 && !(tag && proposed.has(tag.id)) && proposed.size >= limits.tags.perTopic)
    throw new ValidationError({
      message: `Um tópico pode ter até ${limits.tags.perTopic} tags propostas.`,
      action: "Apoie uma das tags já propostas.",
      key: "tag"
    })

  let tagId = tag?.id
  if (!tagId) {
    await assertCanCreate(user, 1)
    tagId = await Tags.create(slug, name.trim(), user.id)
  }

  await Tags.vote(id, tagId, user.id, value)
  await Tags.activate(tagId)

  res.status(200).json({ tags: await Tags.ofTopic(id, pid) })
}

export const getTags: RequestHandler = async (req, res) => {
  const { q, page, pageSize } = validate("tagList", req.query)
  res.status(200).json(await Tags.search(tagSlug(q), page, pageSize))
}

// One tag or an intersection: the tags, how many topics have them all, and the tags those topics
// have most, to narrow it down. `canonical` is the list without aliases, where the page should be.
export const getTagIntersection: RequestHandler = async (req, res) => {
  const { slugs } = validate("tagParams", req.params)
  const requested = splitSlugs(slugs)
  const tags = await resolveFilter(requested)

  if (!tags)
    throw new NotFoundError({
      message: requested.length === 1 ? "Tag não encontrada." : "Alguma dessas tags não existe."
    })

  const { topics, related } = await Tags.intersection(tags.map(tag => tag.id))

  res.status(200).json({
    tags: tags.map(({ slug, name, provisional }) => ({ slug, name, provisional })),
    canonical: tags.map(tag => tag.slug).join(","),
    topics,
    related
  })
}

export const getTagHistory: RequestHandler = async (req, res) => {
  const { id } = validate("contentParams", req.params)
  const topic = await Content.getFieldsOrThrow(id, ["type"])

  // As the poll's history does
  if (topic.type !== "topic")
    throw new NotFoundError({ message: "Tópico não encontrado." })

  res.status(200).json(await Tags.history(id))
}
