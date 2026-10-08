// Load test for the API. Creates its own data, runs each scenario (scenarios.mjs) at each concurrency
// for a fixed time after a warmup, then checks the data survived (integrity.mjs).
//
//   node scripts/loadtest/index.mjs --api http://localhost:3999 --db-path <DB_PATH> --server-pid <pid>
//
// The backend must run with every RATE_LIMIT_* off. --db-path enables the git checks, --server-pid
// the backend's CPU (its own and its git processes') and memory. bench.sh does all of it for a git
// revision, against a throwaway Postgres. Never point it at an instance with real users: it adds data.
import { execFileSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import os from "node:os"
import { parseArgs } from "node:util"

import { Ledger, createClient } from "./client.mjs"
import { createFixture } from "./fixture.mjs"
import { checkIntegrity } from "./integrity.mjs"
import { scenarios } from "./scenarios.mjs"
import { Recorder } from "./stats.mjs"

const { values: options } = parseArgs({
  options: {
    api: { type: "string", default: process.env.API || "http://localhost:3000" },
    "db-path": { type: "string", default: process.env.DB_PATH },
    "server-pid": { type: "string" },
    scenarios: { type: "string", default: Object.keys(scenarios).join(",") },
    concurrency: { type: "string", default: "1,4,16,64" },
    duration: { type: "string", default: "15" },
    warmup: { type: "string", default: "3" },
    label: { type: "string", default: "" },
    out: { type: "string" }
  }
})

const durationS = Number(options.duration)
const warmupS = Number(options.warmup)
const levels = options.concurrency.split(",").map(Number)
const selected = options.scenarios.split(",").map(name => {
  if (!scenarios[name])
    throw new Error(`Unknown scenario "${name}". Available: ${Object.keys(scenarios).join(", ")}`)
  return name
})
const pid = options["server-pid"]
const log = message => console.error(`[loadtest] ${message}`)

// CPU seconds of the backend and of the processes it waited for (git), from /proc/<pid>/stat
const TICKS = Number(execFileSync("getconf", ["CLK_TCK"], { encoding: "utf-8" }))
function cpuSeconds() {
  if (!pid)
    return null
  // The command name, in parentheses, may contain spaces; the fields after it are fixed
  const fields = readFileSync(`/proc/${pid}/stat`, "utf-8").split(") ")[1].split(" ")
  const [utime, stime, cutime, cstime] = fields.slice(11, 15).map(Number)
  return { server: (utime + stime) / TICKS, children: (cutime + cstime) / TICKS }
}
const rssMb = () => pid ? Number(readFileSync(`/proc/${pid}/status`, "utf-8").match(/VmRSS:\s+(\d+)/)[1]) / 1024 : null

const client = createClient(options.api)
const ledger = new Ledger()

async function runPhase(name, concurrency, fixture) {
  const recorder = new Recorder()
  client.setRecorder(recorder)

  const start = performance.now()
  const measureStart = start + warmupS * 1000
  const measureEnd = measureStart + durationS * 1000
  recorder.open(measureStart, measureEnd)

  let cpuBefore, cpuAfter, peakRss = 0
  const sampler = setInterval(() => { peakRss = Math.max(peakRss, rssMb() ?? 0) }, 250)
  const at = (time, take) => new Promise(resolve => setTimeout(() => resolve(take()), time - performance.now()))

  await Promise.all([
    at(measureStart, () => { cpuBefore = cpuSeconds() }),
    at(measureEnd, () => { cpuAfter = cpuSeconds() }),
    ...Array.from({ length: concurrency }, async (_, vu) => {
      while (performance.now() < measureEnd)
        await scenarios[name].iteration({ call: client.call, fixture, ledger, vu, concurrency })
    })
  ])

  clearInterval(sampler)
  client.setRecorder(null)

  const report = recorder.report(durationS)
  const cpu = cpuBefore && cpuAfter ? {
    serverS: Math.round((cpuAfter.server - cpuBefore.server) * 100) / 100,
    gitS: Math.round((cpuAfter.children - cpuBefore.children) * 100) / 100
  } : null
  if (cpu)
    cpu.msPerRequest = report.total.count ? Math.round(((cpu.serverS + cpu.gitS) * 1000 / report.total.count) * 100) / 100 : null

  return { scenario: name, concurrency, ...report, cpu, peakRssMb: pid ? Math.round(peakRss) : null }
}

const pad = (value, width) => String(value ?? "-").padStart(width)
function printPhase(phase) {
  const { total, cpu } = phase
  console.log(`${phase.scenario.padEnd(17)} c=${pad(phase.concurrency, 2)}  ${pad(total.rps, 7)} req/s  p50 ${pad(total.p50, 7)}  p90 ${pad(total.p90, 7)}  p99 ${pad(total.p99, 7)}  max ${pad(total.max, 7)} ms  errors ${pad((total.errorRate * 100).toFixed(1), 5)}%${cpu ? `  cpu ${pad(cpu.msPerRequest, 6)} ms/req` : ""}`)
  for (const [error, count] of Object.entries(phase.errors))
    console.log(`${" ".repeat(24)}${count} × ${error}`)
}

const gitVersion = execFileSync("git", ["version"], { encoding: "utf-8" }).trim()
log(`${options.api}, ${selected.length} scenarios × concurrency ${levels.join("/")}, ${warmupS}s warmup + ${durationS}s each`)

const fixture = await createFixture(client, ledger, log)
const phases = []
for (const name of selected) {
  log(`${name}: ${scenarios[name].description}`)
  for (const concurrency of levels) {
    if (concurrency > (scenarios[name].maxConcurrency ?? Infinity)) {
      log(`  skipping c=${concurrency}: at most ${scenarios[name].maxConcurrency}`)
      continue
    }
    const phase = await runPhase(name, concurrency, fixture)
    phases.push(phase)
    printPhase(phase)
  }
}

log("checking integrity")
const integrity = await checkIntegrity(client, ledger, options["db-path"])
const kinds = Object.groupBy(integrity.problems, problem => problem.kind)
console.log(`\nintegrity: ${integrity.reposChecked ?? "-"} repos, ${integrity.postsCompared} posts, ${integrity.commitsChecked ?? "-"} acknowledged commits, ${integrity.suggestionsChecked ?? "-"} suggestions, ${integrity.createdPostsChecked ?? "-"} created posts`)
if (integrity.problems.length === 0)
  console.log("  no problems found")
for (const [kind, list] of Object.entries(kinds)) {
  console.log(`  ${list.length} × ${kind}`)
  for (const { detail } of list.slice(0, 5))
    console.log(`      ${detail}`)
}

const result = {
  label: options.label,
  startedAt: new Date().toISOString(),
  machine: { cpus: os.cpus().length, cpuModel: os.cpus()[0]?.model, node: process.version, git: gitVersion, platform: `${os.type()} ${os.release()}` },
  settings: { api: options.api, durationS, warmupS, levels, scenarios: selected },
  phases,
  integrity: { ...integrity, problemCounts: Object.fromEntries(Object.entries(kinds).map(([kind, list]) => [kind, list.length])) }
}
if (options.out) {
  writeFileSync(options.out, JSON.stringify(result, null, 2))
  log(`results in ${options.out}`)
}
