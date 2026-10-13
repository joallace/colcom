import React from "react"
import { Link, Navigate, useLocation, useParams, useSearchParams } from "react-router"
import { PiMedalFill } from "react-icons/pi"

import useUser from "@/context/UserContext"
import useApiResource from "@/hooks/useApiResource"
import usePageParam from "@/hooks/usePageParam"
import { loginPath } from "@/assets/returnTo"
import { relativeTime, userPath } from "@/assets/util"
import Spinner from "@/components/primitives/Spinner"
import Focus from "@/components/primitives/Focus"
import FilterPills from "@/components/primitives/FilterPills"
import NoResponse from "@/components/primitives/NoResponse"
import Pagination from "@/components/primitives/Pagination"
import ContentList from "@/components/content/ContentList"
import PrestigeHistory from "@/components/content/PrestigeHistory"

const PAGE_SIZE = 5

// What the profile lists: the value is the URL's `type`, absent for every content; `none` ends the
// sentence saying there's nothing of it. `prestige` lists how the user earned their prestige instead.
const PROFILE_TYPES = [
  { value: undefined, label: "tudo", none: "nenhum conteúdo" },
  { value: "topic", label: "tópicos", none: "nenhum tópico" },
  { value: "post", label: "posts", none: "nenhum post" },
  { value: "critique", label: "críticas", none: "nenhuma crítica" },
  { value: "prestige", label: "prestígio" }
]

// The logged in user's profile (/profile) or anyone's (/users/:name), `?type=` narrowing their
// contents or, with `prestige`, showing where each point of their prestige came from
export default function Profile() {
  const { name } = useParams()
  const location = useLocation()
  const [params] = useSearchParams()
  const { user } = useUser()
  const [page, setPage] = usePageParam()
  const shown = PROFILE_TYPES.find(option => option.value === params.get("type")) ?? PROFILE_TYPES[0]
  const type = shown.value
  const isPrestige = type === "prestige"
  const basePath = name ? userPath(name) : "/profile"
  // The first page of the profile showing `value`
  const typePath = value => value ? `${basePath}?type=${value}` : basePath
  // Anyone's profile is fetched by name; one that can't be had is no such user (null)
  const fetched = useApiResource(name ? userPath(name) : null)
  const profile = name ? (fetched.error ? null : fetched.data) : user
  const isOwn = profile && profile.pid === user?.pid
  // The viewer's interactions come with the contents, so wait to know who's viewing
  const viewerKnown = user !== undefined
  const pid = profile?.pid
  const listPath = isPrestige ?
    `${userPath(profile?.name)}/prestige?page=${page + 1}&pageSize=${PAGE_SIZE}`
    :
    `/contents?authorId=${pid}${type ? `&type=${type}` : ""}&page=${page + 1}&pageSize=${PAGE_SIZE}`
  const contents = useApiResource(pid && viewerKnown ? listPath : null, { deps: [pid, type, page, user?.accessToken, viewerKnown] })
  // Changing pages doesn't change the total, so the pagination stays while another page loads;
  // another type or user asks for it again
  const listKey = `${pid}:${type}`
  const [total, setTotal] = React.useState({ key: null, maxIndex: undefined })
  if (contents.data && total.key !== listKey)
    setTotal({ key: listKey, maxIndex: Math.ceil(contents.data.count / PAGE_SIZE) - 1 })

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
        // Only the profile holds back the whole page; its contents load under the pills
        profile ?
          <>
            <div className="profileCard">
              <img className="avatar" src={`data:image/png;base64,${profile.avatar}`} alt="" />
              <div className="profileInfo">
                <Focus className="username">{profile.name}</Focus>
                <span>se juntou em <Focus>{new Date(profile.created_at).toLocaleDateString('pt-BR')}</Focus>, há <Focus>{relativeTime(profile.created_at)}</Focus></span>
                <Link to={typePath("prestige")} className="profilePrestige">
                  <PiMedalFill aria-hidden="true" /><Focus>{profile.prestige ?? 0}</Focus> de prestígio
                </Link>
              </div>
            </div>
            <div className="tree">
              <header className="profileContentsHeader">
                <hr className="separator" />
                <FilterPills options={PROFILE_TYPES} value={type} pathFor={typePath} />
              </header>
              {!contents.data ?
                contents.error ?
                  <NoResponse>não foi possível se conectar ao colcom.</NoResponse>
                  :
                  <div className="centeredSpinner">
                    <Spinner />
                  </div>
                :
                isPrestige ?
                  <>
                    <p className="prestigeIntro">
                      Cada ponto vem de uma contribuição que outra pessoa confirmou. <Link to="/prestige">Como funciona o prestígio</Link>
                    </p>
                    {contents.data.events.length > 0 ?
                      <PrestigeHistory events={contents.data.events} />
                      :
                      <NoResponse>{isOwn ? "você ainda não conquistou" : `${profile.name} ainda não conquistou`} prestígio.</NoResponse>
                    }
                  </>
                  :
                  contents.data.contents.length > 0 ?
                    <ContentList contents={contents.data.contents} />
                    :
                    <NoResponse>{isOwn ? "você ainda não publicou" : `${profile.name} ainda não publicou`} {shown.none}.</NoResponse>
              }
            </div>
            <Pagination
              path={typePath(type)}
              state={[page, setPage]}
              isLoading={contents.isLoading}
              maxIndex={total.key === listKey ? total.maxIndex : undefined}
            />
          </>
          :
          <Spinner />
      }

    </div>
  )
}
