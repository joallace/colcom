import { resolve } from "path"
import { Pool } from "pg"
import { readFileSync, existsSync, mkdirSync } from "fs"

import logger from "@/logger"


const gitDbPath = process.env.DB_PATH || resolve(__dirname, "db/")

if (!existsSync(gitDbPath)) {
  logger.info(`[database.ts] Creating git db at "${gitDbPath}"`)
  mkdirSync(gitDbPath)
}
else
  logger.info(`[database.ts] Loaded git db at "${gitDbPath}"`)


const config = {
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.POSTGRES_PORT) || 5432,
  database: process.env.POSTGRES_DB || "colcom",
  max: Number(process.env.DB_POOL) || 200,
  idleTimeoutMillis: 0,
  connectionTimeoutMillis: 5000
}
const URL = `postgres://${config.user}:${"*".repeat(config.password?.length || 0)}@${config.host}:${config.port}/${config.database}`

const pool = new Pool(config)

async function connect() {
  try {
    logger.info(`[database.ts] Connecting to db ${URL}`)
    await pool.connect()
  } catch (err) {
    setTimeout(() => {
      connect()
      logger.error(`[database.ts] an error occured when connecting ${err} retrying connection on 3 secs`)
    }, 3000)
  }
}

pool.on("error", connect)

pool.once("connect", () => {
  logger.info(`[database.ts] Connected to db ${URL}`)
  logger.info(`[database.ts] Creating inital tables from "sql/init.sql" if they do not exist`)
  const initSql = readFileSync(resolve(__dirname, "sql/init.sql"), { encoding: "utf-8" })
  return pool.query(initSql)
})

connect()

export { gitDbPath }

export default pool