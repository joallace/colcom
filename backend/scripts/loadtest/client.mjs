// HTTP calls for the load test, and the ledger of every write the API acknowledged, which the
// integrity checks compare with git once the load is over.

const TIMEOUT_MS = 60_000

export function createClient(api) {
  // The recorder of the phase running now; setup calls go unrecorded
  let recorder = null

  async function call(label, method, path, { body, token } = {}) {
    const headers = { ...(body ? { "Content-Type": "application/json" } : {}), ...(token ? { Authorization: `Bearer ${token}` } : {}) }
    const startedAt = performance.now()
    let status, data
    try {
      const res = await fetch(api + path, { method, headers, body: body && JSON.stringify(body), signal: AbortSignal.timeout(TIMEOUT_MS) })
      status = res.status
      const text = await res.text()
      data = text ? JSON.parse(text) : null
    }
    catch (err) {
      status ??= err.name === "TimeoutError" ? "timeout" : "network"
    }
    recorder?.record(label, startedAt, performance.now() - startedAt, status, typeof status === "number" && status >= 400 ? data?.message : undefined)
    return { status, ok: typeof status === "number" && status < 400, data }
  }

  // For setup: anything but success stops the run, since every later number would be meaningless
  async function must(method, path, options) {
    const res = await call("setup", method, path, options)
    if (!res.ok)
      throw new Error(`${method} ${path} → ${res.status} ${JSON.stringify(res.data)}${res.status === 429 ? "\nRun the backend with every RATE_LIMIT_* set to off." : ""}`)
    return res.data
  }

  return { call, must, setRecorder: value => { recorder = value } }
}

// Writes the API acknowledged, per post. After the load, every acknowledged commit must be in its
// branch (no lost writes) and each branch must have exactly as many commits as were acknowledged
// (no phantom writes: a commit that landed while the client was told it failed).
export class Ledger {
  constructor() {
    this.posts = new Map()
    this.suggestions = []
    this.createdPosts = []
  }

  post(topicId, postId) {
    if (!this.posts.has(postId))
      this.posts.set(postId, { topicId, commits: [] })
    return this.posts.get(postId)
  }

  // An author's edit or an accepted suggestion: each adds one commit to the post's first-parent line
  landed(topicId, postId, commit) {
    this.post(topicId, postId).commits.push(commit)
  }

  suggested(topicId, postId, interactionId, commit) {
    this.suggestions.push({ topicId, postId, interactionId, commit })
  }
}
