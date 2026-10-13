// Prestige (GET /prestige, GET /users/:name/prestige): what each award is called, the sentence that
// explains its rule, and how a profile's history says where each point came from

// For each reason (PRESTIGE_REASONS in shared/): `label` names the award in a profile's history,
// `rule` explains it on /prestige (to whoever earns it), `by` says who confirmed it
export const PRESTIGE_RULES = {
  critique_fixed: {
    label: "crítica que levou a uma correção",
    rule: "Uma crítica sua levou a uma correção: o autor corrigiu o trecho e você aceitou, ou incorporou a correção que você sugeriu.",
    by: "corrigida por"
  },
  fix_accepted: {
    label: "correção aceita",
    rule: "Quem criticou seu post aceitou a correção que você fez.",
    by: "aceita por"
  },
  rebuttal_accepted: {
    label: "refutação aceita",
    rule: "Quem criticou seu post aceitou a sua refutação.",
    by: "aceita por"
  },
  suggestion_merged: {
    label: "sugestão incorporada",
    rule: "O autor de um post incorporou uma alteração que você sugeriu. Quando ela corrige uma crítica sua, vale a da crítica.",
    by: "incorporada por"
  },
  suggestion_adopted: {
    label: "sugestão acolhida",
    rule: "Você incorporou ao seu post uma alteração sugerida por outra pessoa.",
    by: "sugerida por"
  }
}

// An amount as it's credited: "+10", "+0", "−5" (with a minus sign, not a hyphen)
export const amountText = amount => amount < 0 ? `−${-amount}` : `+${amount}`

// A limit's window: "por dia", "a cada 30 dias", "por hora", "a cada 15 minutos"
export function windowPhrase(seconds) {
  const units = [[86_400, "dia", "dias"], [3_600, "hora", "horas"], [60, "minuto", "minutos"], [1, "segundo", "segundos"]]
  const [size, one, many] = units.find(([size]) => seconds % size === 0)
  const count = seconds / size
  return count === 1 ? `por ${one}` : `a cada ${count} ${many}`
}

// What each limit means, in a sentence: null when it's lifted
export function limitSentences(limits) {
  const sentences = []
  if (limits?.user)
    sentences.push(`Ninguém ganha mais de ${limits.user.cap} de prestígio ${windowPhrase(limits.user.window)}.`)
  if (limits?.pair) {
    const awards = limits.pair.cap === 1 ? "prêmio" : "prêmios"
    sentences.push(`Ninguém recebe mais de ${limits.pair.cap} ${awards} da mesma pessoa ${windowPhrase(limits.pair.window)}.`)
  }
  return sentences
}

// Why an award was credited less than its rule: the limit that held it back
const HELD_BACK = {
  user: "limite de prestígio por período",
  pair: "limite de prêmios da mesma pessoa"
}

// One award of a profile's history: its name, what it's about (a critique, or the post a suggestion
// went into) and where that is, who confirmed it, and what held it back if anything
export function describePrestige(event) {
  const rule = PRESTIGE_RULES[event.reason]
  const postPath = event.post && event.topic ? `/topics/${event.topic.id}/posts/${event.post.id}` : null

  return {
    label: rule?.label ?? event.reason,
    target: event.critique?.title ?? event.post?.title ?? null,
    path: event.critique && postPath ? `${postPath}?${new URLSearchParams({ critique: event.critique.id })}` : postPath,
    // A critique's post, and a suggestion's message
    context: event.critique ? event.post?.title : event.suggestion?.message,
    by: event.counterpart && rule ? rule.by : null,
    held: event.limited ? `${event.amount} de ${event.rule_amount} creditados: ${HELD_BACK[event.limited]}` : null
  }
}
