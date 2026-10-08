import env from "@/assets/enviroment"


// What a notification says (after the actor's name) and where it leads. `target` is the title of
// what it's about, shown as the link.
export function describeNotification({ type, content, topic_id, subject, suggestion }) {
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
    default:
      return { action: "interagiu com", target: content.title, path: content.type === "topic" ? `/topics/${content.id}` : postPath }
  }
}

// Sent when the unread count is known to have changed (e.g. the notifications page marked some as
// read), so the navbar's badge follows without waiting for its next poll
export const UNREAD_EVENT = "colcom:unread-notifications"

export const announceUnread = unread => window.dispatchEvent(new CustomEvent(UNREAD_EVENT, { detail: unread }))

const authHeaders = token => ({ "Authorization": `Bearer ${token}` })

export async function fetchUnread(token) {
  const res = await fetch(`${env.apiAddress}/notifications/unread`, { headers: authHeaders(token) })
  return res.ok ? (await res.json()).unread : undefined
}

// Marks the given notifications as read, or all of them without `ids`, and announces the new count
export async function markRead(token, ids) {
  const res = await fetch(`${env.apiAddress}/notifications/read`, {
    method: "post",
    headers: { ...authHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(ids ? { ids } : {}),
    // Clicking a notification navigates away right after marking it
    keepalive: true
  })

  if (!res.ok)
    return undefined

  const { unread } = await res.json()
  announceUnread(unread)
  return unread
}
