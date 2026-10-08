const LOGIN = "/login"
const FALLBACK = "/"

// Only paths on this site: "//host" and "/\host" are protocol-relative URLs to other sites,
// which would make the login page an open redirect
const isLocalPath = path => typeof path === "string" && path.startsWith("/") && !/^\/[/\\]/.test(path)

const isLoginPath = path => path === LOGIN || path.startsWith(`${LOGIN}?`) || path.startsWith(`${LOGIN}#`)

// The login page's address, remembering `location` (a router location) to come back to it
export const loginPath = location => {
  const from = location ? `${location.pathname}${location.search ?? ""}${location.hash ?? ""}` : ""
  if (!isLocalPath(from) || from === FALLBACK || isLoginPath(from))
    return LOGIN
  return `${LOGIN}?returnTo=${encodeURIComponent(from)}`
}

// The router state for the login page: `location`'s own, given back on returning, since some
// pages use it (/write takes its topic from it rather than fetching it again)
export const loginState = location => location?.state == null ? undefined : { returnState: location.state }

// Where to go after logging in, from the login page's `returnTo`; anything unsafe goes home
export const returnPath = returnTo =>
  isLocalPath(returnTo) && !isLoginPath(returnTo) ? returnTo : FALLBACK
