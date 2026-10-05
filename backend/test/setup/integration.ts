// Runs before each integration test file: gives it a database cloned from the template (see
// postgres.ts) and an empty git directory, so test files can't see each other's data and can run in
// parallel. pgDatabase.ts and gitDatabase.ts read these variables when the file first imports them.
import { mkdtempSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { randomBytes } from "node:crypto"
import pg from "pg"
import { afterAll, inject } from "vitest"


const { template, ...server } = inject("postgres")
const database = `colcom_test_${randomBytes(6).toString("hex")}`

const admin = new pg.Client({ ...server, database: "postgres" })
await admin.connect()
await admin.query(`CREATE DATABASE ${database} TEMPLATE ${template}`)

process.env.POSTGRES_HOST = server.host
process.env.PGPORT = String(server.port)
process.env.POSTGRES_USER = server.user
process.env.POSTGRES_PASSWORD = server.password
process.env.POSTGRES_DB = database
process.env.DB_PATH = mkdtempSync(join(tmpdir(), "colcom-git-"))

afterAll(async () => {
  const { default: pool } = await import("@/pgDatabase")
  await pool.end()
  await admin.query(`DROP DATABASE IF EXISTS ${database} WITH (FORCE)`)
  await admin.end()
  rmSync(process.env.DB_PATH!, { recursive: true, force: true })
})
