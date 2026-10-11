// The podium (GET /podium/*, the frontend's /podium): how many it ranks and the periods its topics
// and posts are ranked over. Here so the API and the page's explanation of the rule agree.

// The three on the steps and the rest listed under them
export const PODIUM_SIZE = 10

// Each period's length in days: only the up and down votes cast in it count. `all` counts every vote.
export const PODIUM_PERIODS = Object.freeze({ week: 7, month: 30, all: null })
