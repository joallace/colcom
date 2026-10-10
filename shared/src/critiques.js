// A critique's lifecycle. Every way out of "open" is an action by a person: the post's author answers
// it (address, rebut), the critic accepts the answer, disputes it or withdraws the critique, and from
// phase 3 on the public decides disputes. A commit never changes a critique's state. The API enforces
// these rules and the post page offers only the actions they allow, so both read them from here.

export const CRITIQUE_STATES = ["open", "addressed", "rebutted", "resolved", "in_review", "upheld", "withdrawn"]

// States nothing more happens in: their critiques no longer ask anything of the post
export const CLOSED_CRITIQUE_STATES = ["resolved", "withdrawn"]

// `by` is who may take it: the post's "author" or the "critic". `from` lists the states it's taken
// from and `to` the state it leads to. An upheld critique (the public sided with the critic) can be
// answered again, as an open one.
export const CRITIQUE_ACTIONS = Object.freeze({
  address: Object.freeze({ by: "author", from: ["open", "upheld"], to: "addressed" }),
  rebut: Object.freeze({ by: "author", from: ["open", "upheld"], to: "rebutted" }),
  accept: Object.freeze({ by: "critic", from: ["addressed", "rebutted"], to: "resolved" }),
  dispute: Object.freeze({ by: "critic", from: ["addressed", "rebutted"], to: "in_review" }),
  withdraw: Object.freeze({ by: "critic", from: ["open", "addressed", "rebutted", "in_review", "upheld"], to: "withdrawn" })
})

export const isClosedCritique = status => CLOSED_CRITIQUE_STATES.includes(status)

// The actions a user may take on a critique in `status`, given whether they wrote the post and the
// critique. Someone who criticised their own post is both.
export const critiqueActions = (status, { isAuthor = false, isCritic = false } = {}) =>
  Object.entries(CRITIQUE_ACTIONS)
    .filter(([, rule]) => rule.from.includes(status) && (rule.by === "author" ? isAuthor : isCritic))
    .map(([action]) => action)
