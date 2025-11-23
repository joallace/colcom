import { getUserVote, toPercentageStr } from "@/assets/util"
import Focus from "@/components/primitives/Focus"

export const Author = ({ isDesktop, name, avatar }) => {
  return (
    <span className="startedBy">
      {isDesktop && "iniciado por"} <img src={`data:image/png;base64,${avatar}`} /> {name}
    </span>
  )
}

export const Relevance = ({ initialVoteState, relevanceVote, upvotes, downvotes }) => {
  const removeOrAddVote = initialVoteState ? -(relevanceVote === "") : +(relevanceVote === "up" || relevanceVote === "down")
  const allVotes = upvotes + downvotes + removeOrAddVote
  const upvotePercentage = (upvotes + getUserVote(initialVoteState, relevanceVote)) / allVotes

  const percentageToColorHSL = (pct) => `hsl(${pct * 120}, 100%, 50%)` // 0=red, 60=yellow, 120=green

  const Colored = ({ children }) => (
    <Focus style={{ color: percentageToColorHSL(upvotePercentage) }}>
      {children}
    </Focus>
  )

  return (
    allVotes ?
      allVotes === 1 ?
        <>
          <Colored>1</Colored>{" "}votante {!upvotePercentage && "não"} achou relevante
        </>
        :
        <>
          <Colored>
            {toPercentageStr(upvotePercentage)}
          </Colored>
          {"  "} dos <Focus>{allVotes}</Focus> votantes achou relevante
        </>
      :
      <><Colored>0</Colored> votos</>
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