import React from "react"

import api, { ApiError, isAbort } from "@/assets/api"

const sameDeps = (a, b) => a.length === b.length && a.every((value, index) => Object.is(value, b[index]))

// Loads `path` with a GET on mount and again whenever `deps` change (by default, the path itself):
// `{ data, error, isLoading, setData, reload }`. `data` and `error` are only ever the answer to what's
// asked for now, so a page never shows the previous one's; a request that's no longer wanted is
// aborted. A null `path` waits (e.g. until the user is known) and counts as loading.
//
// The path is read when the deps change, so a page can leave parts of it out of them (TopicTree
// asks for the count only once without fetching again when it arrives).
export default function useApiResource(path, { deps } = {}) {
  const wanted = [path == null, ...(deps ?? [path])]
  // Adjusted during render rather than in an effect, so `isLoading` is true on the very render
  // the deps change (see hooks/usePageParam.js)
  const [request, setRequest] = React.useState(() => ({ path, deps: wanted }))
  if (!sameDeps(request.deps, wanted))
    setRequest({ path, deps: wanted })

  const [result, setResult] = React.useState({})

  React.useEffect(() => {
    if (request.path == null)
      return

    const controller = new AbortController()
    api.get(request.path, { signal: controller.signal })
      .then(data => setResult({ request, data }))
      .catch(error => {
        if (isAbort(error))
          return
        // A refusal is the page's to show; anything else (no connection) is also worth a log
        if (!(error instanceof ApiError))
          console.error(error)
        setResult({ request, error })
      })

    return () => controller.abort()
  }, [request])

  const current = result.request === request
  // Changes the loaded data in place (e.g. after an action the page made), keeping it current
  const setData = React.useCallback(update => setResult(prev => (
    prev.request === request ? { ...prev, data: typeof update === "function" ? update(prev.data) : update } : prev
  )), [request])

  // Asks again for the same thing: a new request object is a new effect run
  const reload = React.useCallback(() => setRequest(prev => ({ ...prev })), [])

  return {
    data: current ? result.data : undefined,
    error: current ? result.error : undefined,
    isLoading: !current,
    setData,
    reload
  }
}
