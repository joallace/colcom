import { critiqueActions, isClosedCritique } from "@colcom/shared"

export { critiqueActions, isClosedCritique }

// A critique's state, as its badge reads
export const STATE_LABELS = {
  open: "aberta",
  addressed: "corrigida",
  rebutted: "refutada",
  resolved: "resolvida",
  in_review: "em revisão",
  upheld: "mantida",
  withdrawn: "retirada"
}

// What each state means, for the badge's tooltip
export const STATE_DESCRIPTIONS = {
  open: "aguardando a resposta do autor do post",
  addressed: "o autor diz ter corrigido; aguardando quem criticou",
  rebutted: "o autor contestou a crítica; aguardando quem criticou",
  resolved: "quem criticou aceitou a resposta",
  in_review: "quem criticou não aceitou a resposta",
  upheld: "o público deu razão a quem criticou",
  withdrawn: "quem criticou a retirou"
}

// The buttons offering each action, and what the form asks for it
export const ACTIONS = {
  address: { label: "corrigir", submit: "marcar como corrigida", note: "o que mudou (opcional)", needsNote: false },
  rebut: { label: "refutar", submit: "refutar", note: "por que a crítica não procede", needsNote: true },
  accept: { label: "aceitar resposta", submit: "aceitar", note: "comentário (opcional)", needsNote: false },
  dispute: { label: "contestar resposta", submit: "contestar", note: "por que a resposta não basta", needsNote: true },
  withdraw: { label: "retirar crítica", submit: "retirar", note: "motivo (opcional)", needsNote: false }
}

// What each event of a critique's thread says, after its actor's name
const EVENT_VERBS = {
  address: "corrigiu o trecho",
  rebut: "refutou a crítica",
  accept: "aceitou a resposta",
  dispute: "contestou a resposta",
  withdraw: "retirou a crítica",
  suggest: "sugeriu uma correção",
  merge: "incorporou a correção sugerida"
}

export const describeEvent = ({ action }) => EVENT_VERBS[action] ?? "atualizou a crítica"

export const suggestionState = accepted =>
  accepted === true ? "incorporada" : accepted === false ? "rejeitada" : "pendente"

// The versions that can address a critique: those after the criticised one, newest first. A
// critique made off the post's line (on a merged suggestion) may be addressed by any version.
export function laterVersions(history = [], commit) {
  const index = history.findIndex(version => version.commit === commit)
  return history.slice(index + 1).reverse()
}

// The critiques a user may attach a fix to: their own, still waiting for an answer
export const fixableCritiques = (critiques = [], userPid) =>
  critiques.filter(critique => critique.author_id === userPid && !isClosedCritique(critique.status))
