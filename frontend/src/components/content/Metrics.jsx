import { Link } from "react-router"

import { getUserVote, toPercentageStr, userPath } from "@/assets/util"
import Focus from "@/components/primitives/Focus"
import Popover from "@/components/primitives/Popover"

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

// What the "interactions" metric adds up, in the order its popover lists them
const INTERACTION_TYPES = [
  ["up", "marcações de relevante"],
  ["down", "marcações de não relevante"],
  ["votes", "votos na enquete"],
  ["critiques", "críticas"],
  ["suggestions", "sugestões"]
]

// The total of `counts` (keyed as INTERACTION_TYPES), which opens how much of each it holds
export const Interactions = ({ counts = {}, heading = "interações" }) => {
  const items = INTERACTION_TYPES.map(([type, label]) => ({ type, label, count: counts[type] ?? 0 }))
  const total = items.reduce((sum, { count }) => sum + count, 0)

  return (
    <Popover
      className="interactionsTrigger"
      placement="top"
      heading={heading}
      panelClassName="interactionsBreakdown"
      content={
        <dl>
          {items.map(({ type, label, count }) => (
            <div key={type} className={count ? undefined : "none"}>
              <dt>{label}</dt>
              <dd>{count}</dd>
            </div>
          ))}
        </dl>
      }
    >
      <Focus>{total}</Focus>{" "}interaç{total === 1 ? "ão" : "ões"}
    </Popover>
  )
}