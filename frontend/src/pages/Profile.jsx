import React from "react"
import { useSearchParams } from "react-router-dom"

import env from "@/assets/enviroment"
import useUser from "@/context/UserContext"
import { relativeTime } from "@/assets/util"
import Spinner from "@/components/primitives/Spinner"
import Focus from "@/components/primitives/Focus"
import Topic from "@/components/content/Topic"
import Pagination from "@/components/primitives/Pagination"
import Post from "@/components/content/Post"
import Critique from "@/components/content/Critique"

export default function Profile() {
  const [searchParams] = useSearchParams()
  const [contents, setContents] = React.useState([])
  const [page, setPage] = React.useState(searchParams.get("p") ? searchParams.get("p") - 1 : 0)
  const [pageSize, setPageSize] = React.useState(5)
  const [maxIndex, setMaxIndex] = React.useState()
  const [isLoading, setIsLoading] = React.useState(true)
  const { user } = useUser()

  React.useEffect(() => {
    const fetchUserContent = async () => {
      try {
        setIsLoading(true)
        const url = `${env.apiAddress}/contents?authorId=${user.pid}&page=${page + 1}&pageSize=${pageSize}`
        const res = await fetch(url, { method: "get" })
        const data = await res.json()

        if (res.ok) {
          setContents(data)
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

    if (user)
      fetchUserContent()
  }, [user, page])

  React.useEffect(() => {
    document.title = "Perfil · colcom"
  }, [])

  React.useEffect(() => {
    const pageQuery = searchParams.get("p")
    setPage(pageQuery ? pageQuery - 1 : 0)
  }, [searchParams])
  
  return (
    <div className="centered content">
      {
        user && !isLoading ?
          <>
            <div className="profileCard">
              <img className="avatar" src={`data:image/png;base64,${user?.avatar}`} />
              <div className="profileInfo">
                <Focus className="username">{user?.name}</Focus>
                <span>se juntou em <Focus>{new Date(user?.created_at).toLocaleDateString('pt-BR')}</Focus>, há <Focus>{relativeTime(user?.created_at)}</Focus></span>
              </div>
            </div>
            <div>
              {
                contents?.length > 0 ?
                  <>
                    <hr className="separator"/>
                    {contents?.map(content => {
                      switch (content.type) {
                        case "topic":
                          return <Topic {...content} key={`t${content.id}`} />
                        case "post":
                          return <Post {...content} key={`p${content.id}`} />
                        case "critique":
                          return <Critique {...content} key={`c${content.id}`} />
                      }
                    })}
                  </>
                  : <Spinner />
              }
            </div>
          </>
          :
          <Spinner />
      }

    </div>
  )
}