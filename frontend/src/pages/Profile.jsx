import React from "react"
import { Navigate, useLocation, useParams } from "react-router"

import env from "@/assets/enviroment"
import useUser from "@/context/UserContext"
import usePageParam from "@/hooks/usePageParam"
import { loginPath } from "@/assets/returnTo"
import { relativeTime, userPath } from "@/assets/util"
import Spinner from "@/components/primitives/Spinner"
import Focus from "@/components/primitives/Focus"
import NoResponse from "@/components/primitives/NoResponse"
import Pagination from "@/components/primitives/Pagination"
import ContentList from "@/components/content/ContentList"

const PAGE_SIZE = 5

// The logged in user's profile (/profile) or anyone's (/users/:name)
export default function Profile() {
  const { name } = useParams()
  const location = useLocation()
  const { user } = useUser()
  const [page, setPage] = usePageParam()
  // The profile fetched by name (null when there's no such user) and the contents fetched for a profile
  // and page; each is loading until it's what is asked for
  const [fetchedUser, setFetchedUser] = React.useState({})
  const [loaded, setLoaded] = React.useState({})
  const profile = name ? (fetchedUser.name === name ? fetchedUser.profile : undefined) : user
  const isOwn = profile && profile.pid === user?.pid
  const isLoading = !profile || loaded.pid !== profile.pid || loaded.page !== page
  // The viewer's interactions come with the contents, so wait to know who's viewing
  const viewerKnown = user !== undefined

  React.useEffect(() => {
    if (!name)
      return

    let ignore = false
    const fetchProfile = async () => {
      let profile = null
      try {
        const res = await fetch(`${env.apiAddress}${userPath(name)}`)
        if (res.ok)
          profile = await res.json()
      }
      catch (err) {
        console.error(err)
      }
      if (!ignore)
        setFetchedUser({ name, profile })
    }

    fetchProfile()
    return () => { ignore = true }
  }, [name])

  const pid = profile?.pid
  const accessToken = user?.accessToken
  React.useEffect(() => {
    if (!pid || !viewerKnown)
      return

    let ignore = false
    const fetchUserContent = async () => {
      let contents = [], maxIndex = 0
      try {
        const url = `${env.apiAddress}/contents?authorId=${pid}&page=${page + 1}&pageSize=${PAGE_SIZE}`
        const res = await fetch(url, { method: "get", headers: accessToken ? { "Authorization": `Bearer ${accessToken}` } : {} })
        const data = await res.json()

        if (res.ok) {
          contents = data.contents
          maxIndex = Math.ceil(data.count / PAGE_SIZE) - 1
        }
      }
      catch (err) {
        console.error(err)
      }
      if (!ignore)
        setLoaded({ pid, page, contents, maxIndex })
    }

    fetchUserContent()
    return () => { ignore = true }
  }, [pid, page, accessToken, viewerKnown])

  React.useEffect(() => {
    document.title = `${name ?? "Perfil"} · colcom`
  }, [name])

  if (!name && user === null)
    return <Navigate to={loginPath(location)} replace />

  if (name && profile === null)
    return (
      <div className="centered content">
        <NoResponse>usuário não encontrado.</NoResponse>
      </div>
    )

  return (
    <div className="centered content">
      {
        !isLoading ?
          <>
            <div className="profileCard">
              <img className="avatar" src={`data:image/png;base64,${profile.avatar}`} alt="" />
              <div className="profileInfo">
                <Focus className="username">{profile.name}</Focus>
                <span>se juntou em <Focus>{new Date(profile.created_at).toLocaleDateString('pt-BR')}</Focus>, há <Focus>{relativeTime(profile.created_at)}</Focus></span>
              </div>
            </div>
            <div className="tree">
              <hr className="separator"/>
              {loaded.contents?.length > 0 ?
                <ContentList contents={loaded.contents} />
                :
                <NoResponse>{isOwn ? "você ainda não publicou" : `${profile.name} ainda não publicou`} nenhum conteúdo.</NoResponse>
              }
            </div>
            <Pagination
              path={name ? userPath(name) : "/profile"}
              state={[page, setPage]}
              isLoading={isLoading}
              maxIndex={loaded.maxIndex}
            />
          </>
          :
          <Spinner />
      }

    </div>
  )
}
