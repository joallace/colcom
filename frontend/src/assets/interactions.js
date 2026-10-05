import env from "@/assets/enviroment"

export const submitVote = async (navigate, content_id, type, colcoins = undefined) => {
  const token = localStorage.getItem("accessToken")
  if (!token) {
    navigate("/login")
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
