import { Pool } from "pg"
import logger from "@/logger"
import { readFileSync } from "fs"


const initSql = readFileSync("./sql/init.sql", { encoding: "utf-8" })
const URL = `postgres://${process.env.POSTGRES_USER}:${process.env.POSTGRES_PASSWORD}@${process.env.POSTGRES_HOST}:${process.env.POSTGRES_PORT}/${process.env.POSTGRES_DB}`

const pool = new Pool({
  user: process.env.POSTGRES_USER,
  password: process.env.POSTGRES_PASSWORD,
  host: process.env.POSTGRES_HOST || "localhost",
  port: Number(process.env.POSTGRES_PORT) || 5432,
  database: process.env.POSTGRES_DB || "colcom",
  max: Number(process.env.DB_POOL) || 200,
  idleTimeoutMillis: 0,
  connectionTimeoutMillis: 5000
})

async function connect() {
  try {
    logger.info(`database.ts: Connecting to db ${URL}`)
    await pool.connect()
  } catch (err) {
    setTimeout(() => {
      connect()
      logger.error(`database.js: an error occured when connecting ${err} retrying connection on 3 secs`)
    }, 3000)
  }
}

pool.on("error", connect)

pool.once("connect", () => {
  logger.info(`database.ts: Connected to db ${URL}`)
  logger.info(`database.ts: Creating inital tables from "sql/init.sql" if they do not exist`)
  return pool.query(initSql)
})

connect()

export default pool