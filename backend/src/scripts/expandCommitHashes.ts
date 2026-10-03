import db from "@/pgDatabase"
import git from "@/gitDatabase"
import logger from "@/logger"


// Suggestions and critiques used to store git's short hash, which is only unique inside a single
// repo and no longer matches the full hashes now listed in a post's history. This expands them in
// place. Running it again is harmless, since rows already holding full hashes are skipped.
const sources = [
  {
    table: "interactions",
    query: `
      SELECT
        i.id,
        i.config->>'commit' AS commit,
        post.parent_id AS repo
      FROM
        interactions i
      INNER JOIN
        contents post ON post.id = i.content_id
      WHERE
        i.type = 'suggestion'
      AND
        length(i.config->>'commit') < 40
    ;`
  },
  {
    table: "contents",
    query: `
      SELECT
        critique.id,
        critique.config->>'commit' AS commit,
        post.parent_id AS repo
      FROM
        contents critique
      INNER JOIN
        contents post ON post.id = critique.parent_id
      WHERE
        critique.type = 'critique'
      AND
        length(critique.config->>'commit') < 40
    ;`
  }
]

let updated = 0
let failed = 0

for (const { table, query } of sources) {
  const { rows } = await db.query(query)

  for (const row of rows) {
    try {
      const commit = await git.resolveCommit(row.repo, row.commit)

      await db.query({
        text: `UPDATE ${table} SET config = jsonb_set(config, '{commit}', to_jsonb($1::TEXT)) WHERE id = $2;`,
        values: [commit, row.id]
      })
      updated++
    }
    catch (err) {
      failed++
      logger.error(err, `[expandCommitHashes.ts] Could not expand commit "${row.commit}" of ${table} row ${row.id} in repo ${row.repo}`)
    }
  }
}

logger.info(`[expandCommitHashes.ts] Expanded ${updated} commit hashes, ${failed} failed`)
await db.end()
process.exit(failed > 0 ? 1 : 0)
