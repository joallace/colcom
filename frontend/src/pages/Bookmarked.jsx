import React from "react"

import NoResponse from "@/components/primitives/NoResponse"
import Spinner from "@/components/primitives/Spinner"
import env from "@/assets/enviroment"
import Pagination from "@/components/primitives/Pagination"
import ContentList from "@/components/content/ContentList"
import useUser from "@/context/UserContext"
import usePageParam from "@/hooks/usePageParam"


const PAGE_SIZE = 5

export default function Bookmarked() {
  const [contents, setContents] = React.useState([])
  const [page, setPage] = usePageParam()
  const [maxIndex, setMaxIndex] = React.useState()
  // What the shown contents were fetched for; it's loading until that's what is asked for
  const [loaded, setLoaded] = React.useState({})
  const { user } = useUser()
  const isLoading = loaded.user !== user || loaded.page !== page

  React.useEffect(() => {
    const fetchBookmarked = async () => {
      const headers = user ? { "Authorization": `Bearer ${user.accessToken}` } : undefined
      try {
        const url = `${env.apiAddress}/contents/bookmarked?page=${page + 1}&pageSize=${PAGE_SIZE}`
        const res = await fetch(url, { method: "get", headers })
        const data = await res.json()

        if (res.ok) {
          setContents(data.contents)
          setMaxIndex(prev => prev ?? Math.ceil(data.count / PAGE_SIZE) - 1)
        }
        else {
          setContents([])
          setMaxIndex(0)
        }
      }
      catch (err) {
        console.error(err)
      }
      finally {
        setLoaded({ user, page })
      }
    }

    if(user)
      fetchBookmarked()
  }, [user, page])

  React.useEffect(() => {
    document.title = "colcom: conteúdos salvos"
  }, [])

  return (
    <div className={`content${contents?.length === 0 ? " centered" : " tree"}`}>
      {
        isLoading ?
          <Spinner/>
          :
          contents?.length > 0 ?
            <ContentList contents={contents} />
            :
            <NoResponse>
              ainda não há itens salvos... que tal tentar salvar algum conteúdo?
            </NoResponse>
      }
      <Pagination
        path="/bookmarked"
        state={[page, setPage]}
        isLoading={isLoading}
        maxIndex={maxIndex}
      />
    </div>
  )
}