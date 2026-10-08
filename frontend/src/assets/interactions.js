import env from "@/assets/enviroment"

// `toLogin` is called instead when no one is logged in (see hooks/useToLogin)
export const submitVote = async (toLogin, content_id, type, colcoins = undefined) => {
  const token = localStorage.getItem("accessToken")
  if (!token) {
    toLogin()
    return
  }
  const url = `${env.apiAddress}/interactions`
  const body = JSON.stringify({
    // Ids from the URL are strings; the API takes numbers
    content_id: Number(content_id),
    type,
    colcoins
  })

  const res = await fetch(url, {
    method: "post",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
    body
  })

  if (res.status >= 400) {
    console.error(res)
    return
  }
}
