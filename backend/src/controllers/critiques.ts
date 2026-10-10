import { RequestHandler } from "express"
import { CRITIQUE_ACTIONS, CritiqueAction, CritiqueState, isClosedCritique } from "@colcom/shared"

import git from "@/gitDatabase"
import Critiques from "@/models/critiques"
import Content, { IContent, ListedContent } from "@/models/content"
import { notify, NotificationType } from "@/models/notifications"
import { ConflictError, ForbiddenError, ValidationError } from "@/errors"
import { validate } from "@/validation"
import { findContentOrThrow } from "@/controllers/content"
import logger from "@/logger"


type Critique = Extract<ListedContent, { type: "critique" }>

const STATE_NAMES: Record<CritiqueState, string> = {
  open: "aberta",
  addressed: "corrigida",
  rebutted: "refutada",
  resolved: "resolvida",
  in_review: "em revisão",
  upheld: "mantida",
  withdrawn: "retirada"
}

const NOTIFICATIONS: Record<CritiqueAction, NotificationType> = {
  address: "critique_addressed",
  rebut: "critique_rebutted",
  accept: "critique_accepted",
  dispute: "critique_disputed",
  withdraw: "critique_withdrawn"
}

// The version that addresses a critique must be a later version of the post: one of its own history
// that descends from the criticised one
const validateFixCommit = async (post: IContent, critique: Critique, commit: string) => {
  const isLater = commit !== critique.config.commit
    && await git.isInHistory(post, commit)
    && (await git.ancestors(Number(post.parent_id), commit)).has(critique.config.commit)

  if (!isLater)
    throw new ValidationError({
      message: "A versão que corrige a crítica deve ser uma versão do post posterior à criticada.",
      errorLocationCode: "CONTROLLER:CRITIQUES:VALIDATE_FIX_COMMIT",
      key: "commit"
    })
}

// POST /contents/:id/events: the post's author addresses or rebuts a critique, the critic accepts
// the answer, disputes it or withdraws the critique (shared/src/critiques.js)
export const actOnCritique: RequestHandler = async (req, res) => {
  const user_pid = res.locals.user.pid

  const { id } = validate("contentParams", req.params)
  const { action, note, commit } = validate("critiqueEvent", req.body)
  const critique = await findContentOrThrow(id, "critique")
  const post = await findContentOrThrow(critique.parent_id, "post")
  const rule = CRITIQUE_ACTIONS[action]

  if (rule.by === "author" && user_pid !== post.author_id)
    throw new ForbiddenError({ message: "Somente o autor do post pode responder a esta crítica." })
  if (rule.by === "critic" && user_pid !== critique.author_id)
    throw new ForbiddenError({ message: "Somente o autor da crítica pode fazer isto." })

  const status = critique.status as CritiqueState
  if (!rule.from.includes(status))
    throw new ConflictError({
      message: `Esta crítica está ${STATE_NAMES[status]}, e não admite esta ação.`,
      action: "Atualize a página para ver o estado atual.",
      errorLocationCode: "CONTROLLER:CRITIQUES:ACT:WRONG_STATE"
    })

  if (action === "address")
    await validateFixCommit(post, critique, commit!)

  await Critiques.record({ critique_id: id, actor_pid: user_pid, action, from: status, to: rule.to, note, commit: action === "address" ? commit : undefined })
  await notify({ type: NOTIFICATIONS[action], actor_pid: user_pid, content_id: post.id, subject_id: id })

  res.status(201).json(await Critiques.findThread(id))
}

// A suggestion may be its author's fix for their own critique of the post, still waiting for an
// answer. Checked before the suggestion is written.
export const validateFixedCritique = async (post: IContent, critique_id: number, user_pid: string) => {
  const found = await Content.findById(critique_id)
  const critique = found?.type === "critique" ? found : undefined
  const invalid = (message: string) => new ValidationError({
    message,
    errorLocationCode: "CONTROLLER:CRITIQUES:VALIDATE_FIXED_CRITIQUE",
    key: "critique"
  })

  if (user_pid === post.author_id)
    throw invalid("O autor do post responde às críticas corrigindo-as, sem sugestões.")
  if (!critique || critique.parent_id !== post.id)
    throw invalid("A crítica corrigida não é deste post.")
  if (critique.author_id !== user_pid)
    throw invalid("Somente o autor da crítica pode sugerir uma correção para ela.")
  if (isClosedCritique(critique.status))
    throw invalid(`A crítica já está ${STATE_NAMES[critique.status as CritiqueState]}.`)

  return critique
}

// Records on the critique's thread the fix its critic suggested, once the suggestion exists
export const recordSuggestedFix = async (critique: Critique, suggestion_id: number, user_pid: string) => {
  const status = critique.status as CritiqueState

  try {
    await Critiques.record({ critique_id: critique.id, actor_pid: user_pid, action: "suggest", from: status, to: status, suggestion_id })
  }
  // The suggestion stands on its own; only its mention on the thread is lost
  catch (err) {
    logger.error(err, `[critiques.ts] Failed to record the fix suggested for critique ${critique.id}`)
  }
}

// The post's author merged a critic's fix: the critique is resolved, the critic having proposed the
// fix and the author accepted it. A critique already closed stays as it is.
export const resolveByFix = async (critique_id: number, suggestion_id: number, commit: string, user_pid: string) => {
  try {
    const { status } = await Critiques.findThread(critique_id)
    if (!isClosedCritique(status))
      await Critiques.record({ critique_id, actor_pid: user_pid, action: "merge", from: status, to: "resolved", commit, suggestion_id })
  }
  // The merge is done either way, and the critic can still accept it
  catch (err) {
    logger.error(err, `[critiques.ts] Failed to resolve critique ${critique_id} by its merged fix`)
  }
}
