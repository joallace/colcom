import React from "react"
import { Link, useNavigate } from "react-router"
import {
  PiBookmarkSimple,
  PiBookmarkSimpleFill,
  PiArrowBendUpLeft,
  PiStack,
  PiRanking
} from "react-icons/pi"

import Frame from "@/components/primitives/Frame"
import PostSummary from "@/components/content/PostSummary"
import NoResponse from "@/components/primitives/NoResponse"
import TagList from "@/components/content/TagList"
import { submitVote } from "@/assets/interactions"
import { GROUPED, RANKED, groupByAnswer, loadTopicView, saveTopicView } from "@/assets/topicView"
import { toPercentageStr } from "@/assets/util"
import { Author, Interactions, PostCount, Promotions, Relevance } from "@/components/content/Metrics"
import { UserContext } from "@/context/UserContext"
import useToLogin from "@/hooks/useToLogin"


export default function Topic({
  id,
  author,
  author_avatar,
  title,
  promotions,
  upvotes,
  downvotes,
  config,
  children,
  childrenStats,
  userInteractions,
  userVote,
  tags
}) {
  const initialVoteState = userInteractions?.filter(v => v === "up" || v === "down")[0]
  const [relevanceVote, setRelevanceVote] = React.useState(initialVoteState)
  const [view, setView] = React.useState(loadTopicView)
  const { user, updatePromoted } = React.useContext(UserContext)
  const navigate = useNavigate()
  const toLogin = useToLogin()

  // Open topics (no answers) have nothing to group by
  const hasAnswers = config?.answers?.length > 0
  const grouped = hasAnswers && view === GROUPED

  const changeView = newView => {
    setView(newView)
    saveTopicView(newView)
  }

  const headerConfig = {
    "view": {
      description: ["agrupar por resposta", "ordenar por votos"],
      icons: [PiStack, PiRanking],
      initialValue: grouped,
      hide: !hasAnswers,
      onClick: isGrouped => changeView(isGrouped ? RANKED : GROUPED)
    },
    "answer": {
      description: "responder ao tópico",
      icons: PiArrowBendUpLeft,
      onClick: () => { user ? navigate(`/write?topic=${id}`, { state: { id, title, config } }) : toLogin() }
    },
    "bookmark": {
      description: ["salvar tópico", "remover dos salvos"],
      icons: [PiBookmarkSimple, PiBookmarkSimpleFill],
      initialValue: userInteractions?.includes("bookmark") || false,
      onClick: () => submitVote(toLogin, id, "bookmark")
    }
  }

  const getMetrics = () => {
    // Over the topic's posts, where people take part; the topic's own votes are under "relevance"
    const interactions = {
      up: childrenStats?.upvotes,
      down: childrenStats?.downvotes,
      votes: childrenStats?.votes,
      critiques: childrenStats?.critiques,
      suggestions: childrenStats?.suggestions
    }

    return [
      <Author key="author" name={author} avatar={author_avatar} />,
      <Promotions
        key="promotions"
        userIsPromoting={userInteractions?.includes("promote")}
        userPromotingTopicId={user?.promoting}
        topicId={id}
        promotionCount={promotions}
      />,
      <Relevance key="relevance" {...{ initialVoteState, relevanceVote, upvotes, downvotes }} />,
      <PostCount key="posts" count={childrenStats?.count} />,
      <Interactions key="interactions" counts={interactions} heading="interações com os posts" />
    ]
  }

  const renderPost = (post, rank) => (
    <PostSummary
      key={`p${id}-s${post.id}`}
      parent_id={id}
      id={post.id}
      index={rank}
      shortAnswer={`${rank + 1}. ${post.title}`}
      summary={`${post.body}${post.body.length === 280 ? "..." : ""}`}
      percentage={post.votes / childrenStats?.votes}
      isAuthor={user?.pid === post.author_id}
      chosen={userVote === post.id}
    />
  )

  return (
    <Frame
      id={id}
      title={<Link to={`/topics/${id}`}>{String(title)}</Link>}
      headerConfig={headerConfig}
      relevanceVote={relevanceVote}
      setRelevanceVote={setRelevanceVote}
      definitiveVote={user?.promoting}
      setDefinitiveVote={updatePromoted}
      definitiveVoteType="promote"
      showDefinitiveVoteButton
      metrics={getMetrics}
    >
      {/* In one Fragment: the tags go above the posts, and Frame hands no header state to Fragments */}
      <>
        <TagList topicId={id} tags={tags} />
        {grouped ?
          <div className="answerGroups">
            {groupByAnswer(config.answers, children, childrenStats).map(group => (
              <section className="answerGroup" key={`t${id}-a${group.answer}`}>
                <div className="answerHeader">
                  <div>
                    <h2>{group.answer}</h2>
                    <span>{group.count} post{group.count === 1 ? "" : "s"} • {toPercentageStr(group.percentage)}</span>
                  </div>
                  <div className="answerBar" role="meter" aria-label={group.answer} aria-valuenow={Math.round(group.percentage * 100)} aria-valuemin={0} aria-valuemax={100}>
                    <div style={{ width: `${group.percentage * 100}%` }} />
                  </div>
                </div>
                {group.posts.map(({ post, rank }) => renderPost(post, rank))}
                {group.count > group.posts.length &&
                  <Link to={`/topics/${id}`} className="morePosts">. . .</Link>
                }
              </section>
            ))}
          </div>
          :
          children?.length > 0 ?
            <>
              {children.map((child, i) => renderPost(child, i))}
              {childrenStats?.count > children.length &&
                <Link to={`/topics/${id}`} className="morePosts">. . .</Link>
              }
            </>
            :
            <NoResponse />
        }
      </>
    </Frame>
  )
}
