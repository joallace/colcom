import React from "react"

import NoResponse from "@/components/primitives/NoResponse"
import Spinner from "@/components/primitives/Spinner"
import Pagination from "@/components/primitives/Pagination"
import ContentList from "@/components/content/ContentList"
import useUser from "@/context/UserContext"
import useApiResource from "@/hooks/useApiResource"
import usePageParam from "@/hooks/usePageParam"


const PAGE_SIZE = 5

export default function Bookmarked() {
  const [page, setPage] = usePageParam()
  const [maxIndex, setMaxIndex] = React.useState()
  const { user } = useUser()
  const { data, error, isLoading } = useApiResource(user ? `/contents/bookmarked?page=${page + 1}&pageSize=${PAGE_SIZE}` : null, { deps: [user, page] })
  const contents = data?.contents ?? []

  // Changing pages doesn't change the total; a failure leaves a single page
  if (maxIndex === undefined && data)
    setMaxIndex(Math.ceil(data.count / PAGE_SIZE) - 1)
  else if (error && maxIndex !== 0)
    setMaxIndex(0)

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