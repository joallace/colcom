// Compares load test results of two versions as a Markdown table. Each side takes one or more runs
// (comma-separated); with several, each figure is the median across runs, which irons out a run
// disturbed by something else on the machine.
//
//   node scripts/loadtest/compare.mjs --before a1.json,a2.json --after b1.json,b2.json [--json out.json]
import { readFileSync, writeFileSync } from "node:fs"
import { parseArgs } from "node:util"

import { median } from "./stats.mjs"

const { values: options } = parseArgs({ options: { before: { type: "string" }, after: { type: "string" }, json: { type: "string" } } })
if (!options.before || !options.after)
  throw new Error("usage: compare.mjs --before <runs.json,…> --after <runs.json,…> [--json out.json]")

const load = list => list.split(",").map(path => JSON.parse(readFileSync(path, "utf-8")))
const before = load(options.before)
const after = load(options.after)

const key = phase => `${phase.scenario}@${phase.concurrency}`
const metrics = {
  rps: phase => phase.total.rps,
  p50: phase => phase.total.p50,
  p99: phase => phase.total.p99,
  max: phase => phase.total.max,
  errorRate: phase => phase.total.errorRate,
  cpuMs: phase => phase.cpu?.msPerRequest
}

// Median of each metric over the runs, per scenario and concurrency
function aggregate(runs) {
  const groups = new Map()
  for (const run of runs)
    for (const phase of run.phases) {
      if (!groups.has(key(phase)))
        groups.set(key(phase), [])
      groups.get(key(phase)).push(phase)
    }
  return new Map([...groups].map(([name, phases]) => [name, Object.fromEntries(Object.entries(metrics).map(([metric, get]) => [metric, median(phases.map(get))]))]))
}

const a = aggregate(before)
const b = aggregate(after)

const change = (from, to) => from ? `${to >= from ? "+" : ""}${Math.round(((to - from) / from) * 100)}%` : "-"
const fmt = value => value === null || value === undefined ? "-" : Number.isInteger(value) ? String(value) : value.toFixed(1)
const pct = value => value === null ? "-" : `${(value * 100).toFixed(1)}%`

const rows = []
for (const name of [...b.keys()].filter(name => a.has(name))) {
  const [scenario, concurrency] = name.split("@")
  const x = a.get(name), y = b.get(name)
  rows.push({ scenario, concurrency: Number(concurrency), before: x, after: y })
}

const label = runs => `${runs[0].label} (${runs.length} run${runs.length > 1 ? "s" : ""})`
console.log(`Before: ${label(before)}  \nAfter: ${label(after)}\n`)
console.log("| Scenario | Users | req/s before → after | p50 ms before → after | p99 ms before → after | errors before → after | CPU ms/req before → after |")
console.log("|---|--:|--:|--:|--:|--:|--:|")
for (const { scenario, concurrency, before: x, after: y } of rows)
  console.log(`| ${scenario} | ${concurrency} | ${fmt(x.rps)} → ${fmt(y.rps)} (${change(x.rps, y.rps)}) | ${fmt(x.p50)} → ${fmt(y.p50)} | ${fmt(x.p99)} → ${fmt(y.p99)} | ${pct(x.errorRate)} → ${pct(y.errorRate)} | ${fmt(x.cpuMs)} → ${fmt(y.cpuMs)} |`)

const problems = runs => runs.map(run => Object.entries(run.integrity.problemCounts).map(([kind, count]) => `${count} ${kind}`).join(", ") || "none")
console.log(`\nIntegrity problems per run — before: ${problems(before).join(" | ")}; after: ${problems(after).join(" | ")}`)

if (options.json)
  writeFileSync(options.json, JSON.stringify({ before: before.map(run => run.label), after: after.map(run => run.label), rows }, null, 2))
