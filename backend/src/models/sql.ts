// SQL shared by the models: building a query's parameters, and the fragments several queries repeat


// A query's parameter list. `add` appends a value and returns its placeholder, so a query numbers
// only the parameters it ends up using: Postgres refuses one the query doesn't use.
export function queryParams() {
  const values: unknown[] = []

  const add = (value: unknown, cast?: string) => {
    values.push(value)
    return `$${values.length}${cast ? `::${cast}` : ""}`
  }

  return { values, add }
}

export type QueryParams = ReturnType<typeof queryParams>

type CountedInteraction = "up" | "down" | "vote" | "suggestion"

// A promotion lasts until the end of the day it was made, so an expired one is kept but no longer counts
export const promotionValidSql = (interaction: string) =>
  `(${interaction}.config->>'valid_until')::TIMESTAMP WITH TIME ZONE > NOW()`

// Interactions that still count: all but expired promotions
export const activeInteractionSql = (interaction: string) => `(
  ${interaction}.config IS NULL
  OR
  ${interaction}.config->>'valid_until' IS NULL
  OR
  ${promotionValidSql(interaction)}
)`

// A suggestion the post's author hasn't accepted or rejected yet
export const pendingSuggestionSql = (interaction: string) =>
  `(${interaction}.type = 'suggestion' AND ${interaction}.config->>'accepted' IS NULL)`

// How many interactions of a type a content has received, as a correlated subquery
export const interactionCountSql = (contentId: string, type: CountedInteraction) => `(
  SELECT COUNT(*) FROM interactions AS counted
  WHERE counted.content_id = ${contentId} AND counted.type = '${type}'
)::INT`

// How many promotions a topic has today
export const promotionCountSql = (contentId: string) => `(
  SELECT COUNT(*) FROM interactions AS promotion
  WHERE promotion.content_id = ${contentId} AND promotion.type = 'promote' AND ${promotionValidSql("promotion")}
)::INT`

// A user's interactions with a content, as an array of their types. Promotions count only while
// they last. Shared by every query returning contents to a logged in user.
export const userInteractionsSql = (contentId: string, userParam: string) => `
  ARRAY(
    SELECT
      interactions.type
    FROM
      interactions
    INNER JOIN
      users AS viewer ON viewer.id = interactions.author_id
    WHERE
      viewer.pid = ${userParam}
    AND
      interactions.content_id = ${contentId}
    AND
      ${activeInteractionSql("interactions")}
  )`
