import React from "react"

import env from "@/assets/enviroment"
import useUser from "@/context/UserContext"
import usePageParam from "@/hooks/usePageParam"
import { relativeTime } from "@/assets/util"
import Spinner from "@/components/primitives/Spinner"
import Focus from "@/components/primitives/Focus"
import NoResponse from "@/components/primitives/NoResponse"
import Pagination from "@/components/primitives/Pagination"
import ContentList from "@/components/content/ContentList"

const PAGE_SIZE = 5

export default function Profile() {
  const [contents, setContents] = React.useState([])
  const [page, setPage] = usePageParam()
  const [maxIndex, setMaxIndex] = React.useState()
  // What the shown contents were fetched for; it's loading until that's what is asked for
  const [loaded, setLoaded] = React.useState({})
  const { user } = useUser()
  const isLoading = loaded.user !== user || loaded.page !== page

  React.useEffect(() => {
    const fetchUserContent = async () => {
      try {
        const url = `${env.apiAddress}/contents?authorId=${user.pid}&page=${page + 1}&pageSize=${PAGE_SIZE}`
        const res = await fetch(url, { method: "get", headers: { "Authorization": `Bearer ${user.accessToken}` } })
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

    if (user)
      fetchUserContent()
  }, [user, page])

  React.useEffect(() => {
    document.title = "Perfil · colcom"
  }, [])

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