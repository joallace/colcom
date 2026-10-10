import git from "@/gitDatabase"
import { plainText } from "@/models/content"
import Search from "@/models/search"
import logger from "@/logger"


const BATCH = 100

// Indexes the contents written before search existed (or restored from such a backup): a post's text
// from its branch's tip, since Postgres only has its summary; a topic's or critique's from its row.
// Run at every startup; finds nothing to do once they're all indexed.
export async function indexUnindexed() {
  let indexed = 0

  for (let rows = await Search.unindexed(BATCH); rows.length > 0; rows = await Search.unindexed(BATCH)) {
    for (const row of rows) {
      let body = row.body
      if (row.type === "post") {
        try {
          body = (await git.readLatest(row)) ?? body
        }
        catch (err) {
          // The summary at least, so the row is indexed and not tried again on every batch
          logger.error(err, `[searchIndex.ts] Failed to read post ${row.id}; indexing its summary`)
        }
      }
      await Search.index(row.id, plainText(body))
      indexed++
    }
  }

  if (indexed > 0)
    logger.info(`[searchIndex.ts] Indexed ${indexed} contents for search`)
}
