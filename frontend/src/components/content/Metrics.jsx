import { Link } from "react-router"

import { getUserVote, toPercentageStr, userPath } from "@/assets/util"
import Focus from "@/components/primitives/Focus"

// Only the name links to the profile: the avatar stays out of the link so hovering it (or tapping it
// on a phone) zooms it in rather than navigating
export const Author = ({ isDesktop, name, avatar }) => {
  return (
    <span className="startedBy">
      {isDesktop && "iniciado por"} <img src={`data:image/png;base64,${avatar}`} alt="" /> <Link to={userPath(name)}>{name}</Link>
    </span>
  )
}

// 0 = red, 0.5 = yellow, 1 = green; muted enough to sit in a line of small grey text
const percentageToColorHSL = (pct) => `hsl(${pct * 110}, 55%, 62%)`

const Colored = ({ percentage, children }) => (
  <Focus style={{ color: percentageToColorHSL(percentage) }}>
    {children}
  </Focus>
)

export const Relevance = ({ initialVoteState, relevanceVote, upvotes, downvotes }) => {
  const removeOrAddVote = initialVoteState ? -(relevanceVote === "") : +(relevanceVote === "up" || relevanceVote === "down")
  const allVotes = upvotes + downvotes + removeOrAddVote
  const upvotePercentage = (upvotes + getUserVote(initialVoteState, relevanceVote)) / allVotes

  return (
    allVotes ?
      allVotes === 1 ?
        <>
          <Colored percentage={upvotePercentage}>1</Colored>{" "}votante {!upvotePercentage && "não"} achou relevante
        </>
        :
        <>
          <Colored percentage={upvotePercentage}>
            {toPercentageStr(upvotePercentage)}
          </Colored>
          {"  "} dos <Focus>{allVotes}</Focus> votantes achou relevante
        </>
      :
      <><Colored percentage={upvotePercentage}>0</Colored> votos</>
  )
}

export const Promotions = ({ userIsPromoting, topicId, userPromotingTopicId, promotionCount }) => {
  const removeOrAddPromote = userIsPromoting ?
    -(userPromotingTopicId !== topicId)
    :
    +(userPromotingTopicId === topicId)
  const currentPromotions = promotionCount + removeOrAddPromote

  return (
    <>promovido por {" "}<Focus>{currentPromotions}</Focus>{" "} usuário{currentPromotions === 1 ? "" : "s"}</>
  )
}

export const PostCount = ({ count }) => (<><Focus>{count}</Focus>{" "}post{count === 1 ? "" : "s"}</>)

export const Interactions = ({ count }) => (<><Focus>{count}</Focus>{" "}interaç{count === 1 ? "ão" : "ões"}</>)