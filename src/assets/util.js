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

export const relativeTime = (timestamp) => {
  const now = new Date().getTime()
  const then = new Date(timestamp).getTime()
  let diff = Math.floor((now - then) / 1000)	// Starts in seconds

  const plural = n => n !== 1 ? "s" : ""

  if (diff < 0)
    return "no futuro"

  if (diff < 90)
    return `${diff} segundo${plural(diff)} atrás`

  // Turn it into minutes
  diff = Math.floor((diff + 30) / 60)

  if (diff < 90)
    return `${diff} minuto${plural(diff)} atrás`

  // Turn it into hours
  diff = Math.floor((diff + 30) / 60)

  if (diff < 36)
    return `${diff} hora${plural(diff)} atrás`

  // We deal with number of days from here on
  diff = Math.floor((diff + 12) / 24)

  if (diff < 14)
    return `${diff} dia${plural(diff)} atrás`

  // Say weeks for the past 10 weeks or so
  if (diff < 70){
    const weeks = Math.floor((diff + 3) / 7)
    return `${weeks} semana${plural(weeks)} atrás`
  }

  // Say months for the past 12 months or so
  if (diff < 365){
    const months = Math.floor((diff + 15) / 30)
    return `${months} ${months === 1 ? "mês" : "meses"} atrás`
  }

  // Give years and months for 5 years or so
  if (diff < 1825) {
    const totalMonths = (diff * 12 * 2 + 365) / (365 * 2)
    const years = totalMonths / 12
    const months = totalMonths % 12

    return `${years} ano${plural(years)}${months ? ` e ${months}${diff === 1 ? "mês" : "meses"}` : ""} atrás`
  }

  // Otherwise, just years. Centuries is probably overkill.
  return `${(diff + 183) / 365} anos atrás`
}