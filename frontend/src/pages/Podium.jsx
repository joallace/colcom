import React from "react"
import { Link, useSearchParams } from "react-router"
import { PiCaretDownFill, PiCaretUpFill, PiMedalFill } from "react-icons/pi"

import FilterPills from "@/components/primitives/FilterPills"
import NoResponse from "@/components/primitives/NoResponse"
import Spinner from "@/components/primitives/Spinner"
import Standings from "@/components/primitives/Standings"
import useApiResource from "@/hooks/useApiResource"
import { userPath } from "@/assets/util"
import { PODIUM_PERIOD_OPTIONS, PODIUM_TYPES, periodPhrase, podiumParams, podiumPath, scoreText, votesText } from "@/assets/podium"


const contentPath = content => content.topic ? `/topics/${content.topic.id}/posts/${content.id}` : `/topics/${content.id}`

const renderUser = user => (
  <span className="standingUser">
    <img className="avatar" src={`data:image/png;base64,${user.avatar}`} alt="" />
    <Link to={userPath(user.name)} className="standingName">{user.name}</Link>
  </span>
)

// One piece, so the medal stays beside the number
const renderPrestige = user => <span>{user.prestige}<PiMedalFill title="prestígio" /></span>

// A post also says which topic it answers and with which answer
const renderContent = content => (
  <span className="standingContent">
    <Link to={contentPath(content)} className="standingName">{content.title}</Link>
    {content.topic &&
      <span className="standingDetail">
        em <Link to={`/topics/${content.topic.id}`}>{content.topic.title}</Link>
        {content.config?.answer && <> com <strong>{content.config.answer}</strong></>}
      </span>
    }
    <span className="standingDetail">por <Link to={userPath(content.author)}>{content.author}</Link></span>
  </span>
)

// The balance, and the votes it comes from
const renderRelevance = content => (
  <>
    {scoreText(content.score)}
    <span className="standingVotes" title={votesText(content)}>
      <span aria-hidden="true"><PiCaretUpFill />{content.upvotes} <PiCaretDownFill />{content.downvotes}</span>
      <span className="visuallyHidden">{votesText(content)}</span>
    </span>
  </>
)

// A column's ranking, once loaded; `empty` says why there's no one on it
function Ranking({ resource, entries, empty, ...standings }) {
  if (resource.isLoading)
    return <Spinner />
  if (resource.error)
    return <NoResponse>não foi possível se conectar ao colcom.</NoResponse>
  if (entries.length === 0)
    return <NoResponse>{empty}</NoResponse>
  return <Standings entries={entries} {...standings} />
}

// /podium?type=post&period=month: the users who earned the most prestige beside (on smaller screens,
// above) the topics or posts found most relevant, both over the period
export default function Podium() {
  const [params] = useSearchParams()
  const { type, period } = podiumParams(params)
  const shownType = PODIUM_TYPES.find(option => option.value === type)

  const users = useApiResource(`/podium/users?period=${period}`)
  const contents = useApiResource(`/podium/contents?type=${type}&period=${period}`)

  React.useEffect(() => {
    document.title = "pódio · colcom"
  }, [])

  return (
    <div className="content wide">
      <header className="podiumHeader">
        <h1>pódio</h1>
        <p>Quem mais conquistou prestígio e o que a comunidade achou mais relevante.</p>
        <FilterPills options={PODIUM_PERIOD_OPTIONS} value={period} pathFor={value => podiumPath({ type, period: value })} label="período" />
      </header>
      <div className="podiumColumns">
        <section className="podiumColumn" aria-labelledby="podium-users">
          <header>
            <h2 id="podium-users">prestígio</h2>
            <p>
              Prestígio conquistado {periodPhrase(period)}, com contribuições que outra pessoa confirmou, como uma crítica
              que levou a uma correção. <Link to="/prestige">Como funciona</Link>. Empates dividem a posição.
            </p>
          </header>
          <Ranking
            resource={users}
            entries={(users.data?.users ?? []).map(user => ({ ...user, key: user.pid }))}
            empty={
              <span>
                ninguém conquistou prestígio {periodPhrase(period)}.
                {period !== "all" && <> <Link to={podiumPath({ type, period: "all" })}>ver desde o início</Link></>}
              </span>
            }
            label="usuários por prestígio"
            renderEntry={renderUser}
            renderScore={renderPrestige}
          />
        </section>
        <section className="podiumColumn" aria-labelledby="podium-contents">
          <header>
            <div className="podiumColumnTitle">
              <h2 id="podium-contents">relevância</h2>
              <FilterPills options={PODIUM_TYPES} value={type} pathFor={value => podiumPath({ type: value, period })} />
            </div>
            <p>
              Votos de relevância a favor menos os contra, recebidos {periodPhrase(period)}; o voto do próprio autor não
              conta. Empates dividem a posição.
            </p>
          </header>
          <Ranking
            resource={contents}
            entries={(contents.data?.contents ?? []).map(content => ({ ...content, key: content.id }))}
            empty={
              // One flex item, so the link flows with the sentence
              <span>
                {shownType.none} recebeu mais votos de relevância a favor que contra {periodPhrase(period)}.
                {period !== "all" && <> <Link to={podiumPath({ type, period: "all" })}>ver desde o início</Link></>}
              </span>
            }
            label={`${shownType.label} por relevância`}
            renderEntry={renderContent}
            renderScore={renderRelevance}
          />
        </section>
      </div>
    </div>
  )
}
