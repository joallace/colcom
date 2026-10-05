// Global setup of the integration tests: a PostgreSQL server holding a template database with the
// schema, which every test file clones into a database of its own (see integration.ts).
//
// By default a throwaway cluster is created with the local PostgreSQL binaries (initdb, pg_ctl),
// found on PATH, in PG_BIN or under /usr/lib/postgresql/<version>/bin, and removed afterwards.
// To use a running server instead (e.g. a CI service container), set TEST_POSTGRES_HOST and
// optionally TEST_POSTGRES_PORT, TEST_POSTGRES_USER and TEST_POSTGRES_PASSWORD.
import { execFileSync } from "node:child_process"
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs"
import { createServer } from "node:net"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { randomBytes } from "node:crypto"
import pg from "pg"
import type { TestProject } from "vitest/node"


export interface PostgresServer {
  host: string,
  port: number,
  user: string,
  password: string,
  template: string
}

declare module "vitest" {
  export interface ProvidedContext {
    postgres: PostgresServer
  }
}

function findBinary(name: string): string {
  const candidates = [
    process.env.PG_BIN && join(process.env.PG_BIN, name),
    ...(existsSync("/usr/lib/postgresql") ?
      readdirSync("/usr/lib/postgresql")
        .sort((a, b) => Number(b) - Number(a))
        .map(version => `/usr/lib/postgresql/${version}/bin/${name}`)
      :
      [])
  ].filter(Boolean) as string[]

  const found = candidates.find(path => existsSync(path))
  if (found)
    return found

  try {
    return execFileSync("which", [name], { encoding: "utf-8" }).trim()
  }
  catch {
    throw new Error(`"${name}" not found. Install PostgreSQL, set PG_BIN to its bin directory, or set TEST_POSTGRES_HOST to use a running server.`)
  }
}

const freePort = () => new Promise<number>((resolvePort, reject) => {
  const server = createServer()
  server.unref()
  server.on("error", reject)
  server.listen(0, "localhost", () => {
    const { port } = server.address() as { port: number }
    server.close(() => resolvePort(port))
  })
})

async function startCluster() {
  const dir = mkdtempSync(join(tmpdir(), "colcom-pg-"))
  const data = join(dir, "data")
  const port = await freePort()
  const pgCtl = findBinary("pg_ctl")

  execFileSync(findBinary("initdb"), ["-D", data, "-U", "postgres", "--auth=trust", "-E", "UTF8", "--locale=C"], { stdio: "pipe" })
  // Durability is pointless for a cluster that is deleted afterwards, and slows every write
  const options = `-p ${port} -k ${dir} -c listen_addresses=localhost -c fsync=off -c synchronous_commit=off -c full_page_writes=off`
  execFileSync(pgCtl, ["-D", data, "-o", options, "-l", join(dir, "postgres.log"), "-w", "start"], { stdio: "pipe" })

  return {
    server: { host: "localhost", port, user: "postgres", password: "" },
    stop() {
      try {
        execFileSync(pgCtl, ["-D", data, "-m", "immediate", "stop"], { stdio: "pipe" })
      }
      finally {
        rmSync(dir, { recursive: true, force: true })
      }
    }
  }
}

export default async function setup(project: TestProject) {
  const external = process.env.TEST_POSTGRES_HOST
  const cluster = external ? undefined : await startCluster()
  const server = cluster?.server ?? {
    host: external!,
    port: Number(process.env.TEST_POSTGRES_PORT) || 5432,
    user: process.env.TEST_POSTGRES_USER || "postgres",
    password: process.env.TEST_POSTGRES_PASSWORD || ""
  }
  // Unique, so concurrent runs against the same external server don't collide
  const template = `colcom_template_${randomBytes(4).toString("hex")}`

  const admin = new pg.Client({ ...server, database: "postgres" })
  await admin.connect()
  await admin.query(`CREATE DATABASE ${template}`)
  await admin.end()

  const client = new pg.Client({ ...server, database: template })
  await client.connect()
  await client.query(readFileSync(resolve(import.meta.dirname, "../../src/sql/init.sql"), "utf-8"))
  await client.end()

  project.provide("postgres", { ...server, template })

  return async () => {
    try {
      if (external) {
        const admin = new pg.Client({ ...server, database: "postgres" })
        await admin.connect()
        await admin.query(`DROP DATABASE IF EXISTS ${template} WITH (FORCE)`)
        await admin.end()
      }
    }
    finally {
      cluster?.stop()
    }
  }
}
