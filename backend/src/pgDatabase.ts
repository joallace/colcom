import pg from "pg"
import { dirname, resolve } from "path"
import { fileURLToPath } from "url"
import { readFileSync } from "fs"

import logger from "@/logger"


const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);


const config = {
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.PGPORT) || 5432,
  database: process.env.POSTGRES_DB || "colcom",
  max: Number(process.env.DB_POOL) || 200,
  idleTimeoutMillis: 0,
  connectionTimeoutMillis: 5000
}
const URL = `postgres://${config.user}:${"*".repeat(config.password?.length || 0)}@${config.host}:${config.port}/${config.database}`

const pool = new pg.Pool(config)

async function connect() {
  try {
    logger.info(`[pgDatabase.ts] Connecting to db ${URL}`)
    await pool.connect()
  } catch (err) {
    setTimeout(() => {
      connect()
      logger.error(`[pgDatabase.ts] an error occured when connecting ${err} retrying connection on 3 secs`)
    }, 3000)
  }
}

pool.on("error", connect)

pool.once("connect", () => {
  logger.info(`[pgDatabase.ts] Connected to db ${URL}`)
  logger.info(`[pgDatabase.ts] Creating inital tables from "sql/init.sql" if they do not exist`)
  const initSql = readFileSync(resolve(__dirname, "sql/init.sql"), { encoding: "utf-8" })
  return pool.query(initSql)
})

connect()

export default pool