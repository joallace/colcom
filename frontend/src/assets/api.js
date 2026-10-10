import env from "@/assets/enviroment"


// The session's token lives in localStorage and nowhere else: `UserProvider` writes and removes it
// together with the user, this module (outside React) can read it at the moment of each request,
// and other tabs share it, so a session ended in one is never sent again from another
export const TOKEN_KEY = "accessToken"

export const getToken = () => localStorage.getItem(TOKEN_KEY)

// Sent when the API refuses the token a request carried (expired, or revoked on some device).
// `UserProvider` listens and logs out, so no page takes anonymous data as the user's own.
export const SESSION_ENDED_EVENT = "colcom:session-ended"

// A refused request. Carries the API's error body (`message`, `action`, `key`, `errors`,
// `errorLocationCode`…) both as fields and whole in `data`, for `responseErrors(data)`.
export class ApiError extends Error {
  constructor(status, data) {
    super(data?.message ?? `HTTP ${status}`)
    this.name = "ApiError"
    this.status = status
    this.data = data ?? {}
    this.action = data?.action
    this.key = data?.key
    this.errors = data?.errors
    this.errorLocationCode = data?.errorLocationCode
  }
}

// An empty body (204, or a failed proxy's HTML) has no JSON to read
const readBody = async res => {
  if (res.status === 204)
    return undefined
  try {
    return await res.json()
  }
  catch {
    return undefined
  }
}

// `auth: false` sends no token (logging in and signing up: a wrong password is a 401 that must not
// log anyone out); `token` sends a given one instead of the stored one (logging out, after it's
// forgotten). Other options (`signal`, `keepalive`…) go to `fetch` as they are.
export async function request(method, path, { body, auth = true, token, headers, ...options } = {}) {
  const sent = token ?? (auth ? getToken() : null)
  const res = await fetch(`${env.apiAddress}${path}`, {
    method,
    ...options,
    headers: {
      ...(body !== undefined && { "Content-Type": "application/json" }),
      ...(sent && { "Authorization": `Bearer ${sent}` }),
      ...headers
    },
    ...(body !== undefined && { body: JSON.stringify(body) })
  })
  const data = await readBody(res)

  if (!res.ok) {
    // Only when it's still the stored token: a late answer to an old session's request must not
    // end the one logged into since
    if (res.status === 401 && sent && sent === getToken())
      window.dispatchEvent(new CustomEvent(SESSION_ENDED_EVENT))
    throw new ApiError(res.status, data)
  }

  return data
}

const api = {
  request,
  get: (path, options) => request("GET", path, options),
  post: (path, body, options) => request("POST", path, { ...options, body }),
  patch: (path, body, options) => request("PATCH", path, { ...options, body })
}

export default api

export const isAbort = err => err?.name === "AbortError"
