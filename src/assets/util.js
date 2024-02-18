export const toPercentageStr = (number) => ((number || 0) * 100.0).toFixed(2).replace(/\.(\d)0/, ".$1").replace(".0", "") + "%"

export const getUserVote = (initialVoteState, relevanceVote) => {
    if (relevanceVote === initialVoteState)
      return 0
    if (relevanceVote === "up" && (initialVoteState === "down" || !initialVoteState))
      return 1
    if ((relevanceVote === "down" || !relevanceVote) && initialVoteState === "up")
      return -1

    return 0
  }