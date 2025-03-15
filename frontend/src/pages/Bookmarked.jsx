import React from "react"
import { useSearchParams } from "react-router-dom"

import NoResponse from "@/components/primitives/NoResponse"
import env from "@/assets/enviroment"
import Topic from "@/components/content/Topic"
import Pagination from "@/components/primitives/Pagination"
import Post from "@/components/content/Post"
import Critique from "@/components/content/Critique"
import useUser from "@/context/UserContext"


export default function Bookmarked() {
  const [searchParams] = useSearchParams();
  const [contents, setContents] = React.useState([])
  const [page, setPage] = React.useState(searchParams.get("p") ? searchParams.get("p") - 1 : 0)
  const [pageSize, setPageSize] = React.useState(5)
  const [maxIndex, setMaxIndex] = React.useState()
  const [isLoading, setIsLoading] = React.useState(true)
  const { user } = useUser()

  React.useEffect(() => {
    const fetchBookmarked = async () => {
      const headers = user ? { "Authorization": `Bearer ${user.accessToken}` } : undefined
      try {
        setIsLoading(true)
        const url = `${env.apiAddress}/contents/bookmarked?page=${page + 1}&pageSize=${pageSize}`
        const res = await fetch(url, { method: "get", headers })
        const data = await res.json()

        if (res.ok) {
          setContents(data.contents)
          if (maxIndex === undefined)
            setMaxIndex(Math.floor(data.count / pageSize))
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
        setIsLoading(false)
      }
    }

    if(user)
      fetchBookmarked()
  }, [user, page])

  React.useEffect(() => {
    const pageQuery = searchParams.get("p")
    setPage(pageQuery ? pageQuery - 1 : 0)
  }, [searchParams])

  React.useEffect(() => {
    document.title = "colcom: conteúdos salvos"
  }, [])

  return (
    <div className={`content${contents?.length === 0 ? " centered" : ""}`}>
      {
        isLoading ?
          <div className="spinner" />
          :
          contents?.length > 0 ?
            contents?.map(content => {
              switch (content.type) {
                case "topic":
                  return <Topic {...content} key={`t${content.id}`} />
                case "post":
                  return <Post {...content} key={`p${content.id}`} />
                case "critique":
                  return <Critique {...content} key={`c${content.id}`} />
              }
            })
            :
            <NoResponse>
              ainda não há itens salvos, que tal tentar salvar algum conteúdo?
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