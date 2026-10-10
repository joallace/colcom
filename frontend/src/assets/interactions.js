import api, { ApiError, getToken } from "@/assets/api"

// `toLogin` is called instead when no one is logged in (see hooks/useToLogin)
export const submitVote = async (toLogin, content_id, type, colcoins = undefined) => {
  if (!getToken()) {
    toLogin()
    return
  }

  try {
    await api.post("/interactions", {
      // Ids from the URL are strings; the API takes numbers
      content_id: Number(content_id),
      type,
      colcoins
    })
  }
  catch (err) {
    // The buttons already show the vote; a refusal is only logged, as it always was
    if (!(err instanceof ApiError))
      throw err
    console.error(err)
  }
}
