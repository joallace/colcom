// Prestige (the backend's prestige_rules and prestige_events, the frontend's /prestige and the
// profile's history): what earns it. Each reason is a rule whose amount the instance sets; here so
// the API and the pages that explain each award agree on the names.

// critique_fixed: the critic, for a critique resolved by a fix (the author's, accepted, or their own, merged)
// fix_accepted, rebuttal_accepted: the post's author, for an answer the critic accepted
// suggestion_merged: whoever suggested an edit the post's author merged
// suggestion_adopted: the post's author, for merging someone's suggestion
export const PRESTIGE_REASONS = ["critique_fixed", "fix_accepted", "rebuttal_accepted", "suggestion_merged", "suggestion_adopted"]

// What held an award back: the most anyone earns in a window (`user`), or from one person (`pair`)
export const PRESTIGE_LIMITS = ["user", "pair"]
