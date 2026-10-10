import React from "react"
import { Navigate, useLocation, useParams } from "react-router"

import useUser from "@/context/UserContext"
import useApiResource from "@/hooks/useApiResource"
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
  // Anyone's profile is fetched by name; one that can't be had is no such user (null)
  const fetched = useApiResource(name ? userPath(name) : null)
  const profile = name ? (fetched.error ? null : fetched.data) : user
  const isOwn = profile && profile.pid === user?.pid
  // The viewer's interactions come with the contents, so wait to know who's viewing
  const viewerKnown = user !== undefined
  const pid = profile?.pid
  const contents = useApiResource(
    pid && viewerKnown ? `/contents?authorId=${pid}&page=${page + 1}&pageSize=${PAGE_SIZE}` : null,
    { deps: [pid, page, user?.accessToken, viewerKnown] }
  )
  const isLoading = !profile || contents.isLoading
  const maxIndex = contents.data ? Math.ceil(contents.data.count / PAGE_SIZE) - 1 : 0

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
              {contents.data?.contents.length > 0 ?
                <ContentList contents={contents.data.contents} />
                :
                <NoResponse>{isOwn ? "você ainda não publicou" : `${profile.name} ainda não publicou`} nenhum conteúdo.</NoResponse>
              }
            </div>
            <Pagination
              path={name ? userPath(name) : "/profile"}
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
