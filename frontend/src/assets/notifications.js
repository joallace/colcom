import api, { ApiError } from "@/assets/api"
import { awardText } from "@/assets/prestige"


const CRITIQUE_ANSWERS = {
  critique_addressed: "corrigiu o trecho que você criticou em",
  critique_rebutted: "refutou sua crítica a",
  critique_accepted: "aceitou sua resposta a uma crítica em",
  critique_disputed: "contestou sua resposta a uma crítica em",
  critique_withdrawn: "retirou uma crítica a"
}

// An award told on its own, from whoever confirmed it (the API's 'prestige' notifications), by the
// reason it was given. The usual ones are earned by the recipient's own action: accepting a fix
// (critique_fixed) or merging a suggestion (suggestion_adopted).
const AWARDS = {
  // Unlike critique_addressed (the fix, before the critic accepted it), the critique's resolution
  critique_fixed: "resolveu sua crítica com uma correção em",
  fix_accepted: "aceitou sua correção de uma crítica em",
  rebuttal_accepted: "aceitou sua refutação de uma crítica em",
  suggestion_merged: "incorporou sua sugestão a",
  suggestion_adopted: "sugeriu a alteração que você incorporou a"
}

// What a notification says (after the actor's name), where it leads and, when it earned the
// recipient prestige, how much (`award`). `target` is the title of what it's about, shown as the link.
export function describeNotification(notification) {
  const described = describeAction(notification)
  return notification.prestige ? { ...described, award: awardText(notification.prestige) } : described
}

function describeAction({ type, content, topic_id, subject, suggestion, prestige }) {
  const postPath = `/topics/${topic_id}/posts/${content.id}`

  switch (type) {
    case "critique":
      return {
        action: "criticou seu post",
        target: content.title,
        path: `${postPath}?${new URLSearchParams({ commit: subject.commit ?? "", critique: subject.id })}`
      }
    case "suggestion":
      return { action: "sugeriu uma alteração no seu post", target: content.title, path: postPath, detail: suggestion?.message }
    case "suggestion_accepted":
      return { action: "aceitou sua sugestão para", target: content.title, path: postPath, detail: suggestion?.message }
    case "suggestion_rejected":
      return { action: "rejeitou sua sugestão para", target: content.title, path: postPath, detail: suggestion?.message }
    case "post":
      return { action: "respondeu ao seu tópico", target: content.title, path: `/topics/${topic_id}/posts/${subject.id}`, detail: subject.title }
    case "clone":
      return { action: "criou um post a partir do seu", target: content.title, path: `/topics/${topic_id}/posts/${subject.id}`, detail: subject.title }
    // Answers about a critique open it on the post's latest version, where its thread is
    case "critique_addressed":
    case "critique_rebutted":
    case "critique_accepted":
    case "critique_disputed":
    case "critique_withdrawn":
      return {
        action: CRITIQUE_ANSWERS[type],
        target: content.title,
        path: `${postPath}?${new URLSearchParams({ critique: subject.id })}`,
        detail: subject.title
      }
    // About a critique when it has one, else about the post (a suggestion)
    case "prestige":
      return {
        action: AWARDS[prestige?.reason] ?? "confirmou sua contribuição em",
        target: content.title,
        path: subject ? `${postPath}?${new URLSearchParams({ critique: subject.id })}` : postPath,
        detail: subject ? subject.title : suggestion?.message
      }
    default:
      return { action: "interagiu com", target: content.title, path: content.type === "topic" ? `/topics/${content.id}` : postPath }
  }
}

// Sent when the unread count is known to have changed (e.g. the notifications page marked some as
// read), so the navbar's badge follows without waiting for its next poll
export const UNREAD_EVENT = "colcom:unread-notifications"

export const announceUnread = unread => window.dispatchEvent(new CustomEvent(UNREAD_EVENT, { detail: unread }))

// The count, or undefined when the API refuses
export async function fetchUnread() {
  try {
    return (await api.get("/notifications/unread")).unread
  }
  catch (err) {
    if (err instanceof ApiError)
      return undefined
    throw err
  }
}

// Marks the given notifications as read, or all of them without `ids`, and announces the new count
export async function markRead(ids) {
  let unread
  try {
    // Clicking a notification navigates away right after marking it
    ({ unread } = await api.post("/notifications/read", ids ? { ids } : {}, { keepalive: true }))
  }
  catch (err) {
    if (err instanceof ApiError)
      return undefined
    throw err
  }

  announceUnread(unread)
  return unread
}
