// An unpublished post, kept in this browser per topic so a draft never shows up in another topic

const key = (topicId, field) => `draft:${topicId}:${field}`

const read = name => {
  try {
    return localStorage.getItem(name) ?? ""
  }
  catch {
    return ""
  }
}

export function loadDraft(topicId) {
  return { title: read(key(topicId, "title")), body: read(key(topicId, "body")) }
}

// `field` is "title" or "body"
export function saveDraft(topicId, field, value) {
  try {
    localStorage.setItem(key(topicId, field), value ?? "")
  }
  catch {
    // Storage may be blocked or full; the draft just isn't kept
  }
}

export function clearDraft(topicId) {
  try {
    localStorage.removeItem(key(topicId, "title"))
    localStorage.removeItem(key(topicId, "body"))
  }
  catch {
    // Nothing was kept
  }
}
