import app from "@/app"
import logger from "@/logger"
import { ready } from "@/pgDatabase"
import { ensureMeta } from "@/meta"

const port = process.env.PORT || 3000

app.listen(port, () => {
  logger.info(`server.ts: Listening on port ${port}`)
})

// The site works without its foundational topics, so a failure is logged and retried on the next start
ready.then(ensureMeta).catch(err => {
  logger.error(err, "server.ts: Failed to open the meta topics")
})
