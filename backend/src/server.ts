import app from "@/app"
import config from "@/config"
import logger from "@/logger"
import { ready } from "@/pgDatabase"
import { ensureMeta } from "@/meta"
import { indexUnindexed } from "@/searchIndex"
import Prestige from "@/models/prestige"

const port = process.env.PORT || 3000

app.listen(port, () => {
  logger.info(`server.ts: Listening on port ${port}`)
})

// The site works without its foundational topics, so a failure is logged and retried on the next start
ready.then(ensureMeta).catch(err => {
  logger.error(err, "server.ts: Failed to open the meta topics")
})

// The awards read the limits from the database; until they're written, the last ones written stand
ready.then(() => Prestige.applyLimits(config.prestige)).catch(err => {
  logger.error(err, "server.ts: Failed to apply the prestige limits")
})

// Search works meanwhile, only without the contents still to be indexed
ready.then(indexUnindexed).catch(err => {
  logger.error(err, "server.ts: Failed to index contents for search")
})
