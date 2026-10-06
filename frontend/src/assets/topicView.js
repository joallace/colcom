// A topic shows its posts either ranked by poll votes or grouped by the answer they defend

const VIEW_KEY = "topicView"

export const GROUPED = "answers"
export const RANKED = "votes"

// The last view the reader picked, used for every topic shown afterwards
export function loadTopicView() {
  try {
    return localStorage.getItem(VIEW_KEY) === GROUPED ? GROUPED : RANKED
  }
  catch {
    return RANKED
  }
}

export function saveTopicView(view) {
  try {
    localStorage.setItem(VIEW_KEY, view)
  }
  catch {
    // Storage may be blocked; the view still changes for this page
  }
}

// One group per answer, in the topic's order, so groups don't move as votes come in. Totals come
// from `stats.answers`, which covers every post, while `posts` may be only the few a list shows.
// Each post keeps its `rank` in the vote ordering, so it has the same number in both views
export function groupByAnswer(answers = [], posts = [], stats = {}) {
  const ranked = posts.map((post, rank) => ({ post, rank }))

  return answers.map(answer => {
    const { count = 0, votes = 0 } = stats?.answers?.[answer] ?? {}

    return {
      answer,
      count,
      votes,
      percentage: stats?.votes ? votes / stats.votes : 0,
      posts: ranked.filter(({ post }) => post.config?.answer === answer)
    }
  })
}
