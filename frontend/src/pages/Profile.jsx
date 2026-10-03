import React from "react"
import { useSearchParams } from "react-router"

import env from "@/assets/enviroment"
import useUser from "@/context/UserContext"
import { relativeTime } from "@/assets/util"
import Spinner from "@/components/primitives/Spinner"
import Focus from "@/components/primitives/Focus"
import NoResponse from "@/components/primitives/NoResponse"
import Pagination from "@/components/primitives/Pagination"
import ContentList from "@/components/content/ContentList"

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
        const res = await fetch(url, { method: "get", headers: { "Authorization": `Bearer ${user.accessToken}` } })
        const data = await res.json()

        if (res.ok) {
          setContents(data.contents)
          if (maxIndex === undefined)
            setMaxIndex(Math.ceil(data.count / pageSize) - 1)
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
              <hr className="separator"/>
              {contents?.length > 0 ?
                <ContentList contents={contents} />
                :
                <NoResponse>você ainda não publicou nenhum conteúdo.</NoResponse>
              }
            </div>
            <Pagination
              path="/profile"
              state={[page, setPage]}
              isLoading={isLoading}
              maxIndex={maxIndex}
            />
          </>
          :
          <Spinner />
      }

    </div>
  )
}