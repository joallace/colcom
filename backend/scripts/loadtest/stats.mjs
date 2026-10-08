// Latency statistics for the load test. Every sample is kept (a run makes at most a few hundred
// thousand), so percentiles are exact instead of estimated from histogram buckets.

// Nearest-rank percentile of an ascending array: the smallest sample with at least p% of the
// samples at or below it. Unlike interpolation, it always returns a latency that was measured.
export function percentile(sorted, p) {
  if (sorted.length === 0)
    return null
  const rank = Math.ceil((p / 100) * sorted.length) - 1
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank))]
}

// Missing values (a phase without CPU figures) are left out
export function median(values) {
  const sorted = values.filter(value => value !== null && value !== undefined).sort((a, b) => a - b)
  if (sorted.length === 0)
    return null
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

const round = value => value === null ? null : Math.round(value * 10) / 10

// Count, throughput over the measured window, and latency percentiles in milliseconds
export function summarize(latencies, seconds) {
  const sorted = Float64Array.from(latencies).sort()
  const sum = sorted.reduce((total, value) => total + value, 0)
  return {
    count: sorted.length,
    rps: round(sorted.length / seconds),
    mean: round(sorted.length ? sum / sorted.length : null),
    p50: round(percentile(sorted, 50)),
    p90: round(percentile(sorted, 90)),
    p99: round(percentile(sorted, 99)),
    max: round(sorted.length ? sorted[sorted.length - 1] : null)
  }
}

// Collects the requests of one phase by label (e.g. "PATCH /contents/:id"). Only requests that
// start inside the measured window count, so the warmup and the requests still running when the
// window closes don't skew throughput.
export class Recorder {
  constructor() {
    this.window = null
    this.labels = new Map()
  }

  open(start, end) {
    this.window = { start, end }
  }

  // `status` is the HTTP status, or "timeout" / "network" when no response came back
  record(label, startedAt, latency, status, message) {
    if (!this.window || startedAt < this.window.start || startedAt >= this.window.end)
      return

    let entry = this.labels.get(label)
    if (!entry)
      this.labels.set(label, entry = { ok: [], all: [], errors: new Map() })

    entry.all.push(latency)
    if (typeof status === "number" && status < 400)
      entry.ok.push(latency)
    else {
      // The API's message tells a 409 from a lost race apart from one for a duplicate, for instance
      const key = message ? `${status} ${message}` : String(status)
      entry.errors.set(key, (entry.errors.get(key) ?? 0) + 1)
    }
  }

  // Latencies cover every response, errors included: a fast 409 is still a request the server served
  report(seconds) {
    const endpoints = {}
    const all = []
    const errors = {}
    let failed = 0

    for (const [label, entry] of [...this.labels].sort(([a], [b]) => a.localeCompare(b))) {
      const entryErrors = Object.fromEntries(entry.errors)
      const entryFailed = entry.all.length - entry.ok.length
      endpoints[label] = { ...summarize(entry.all, seconds), errors: entryFailed, errorRate: errorRate(entryFailed, entry.all.length), errorKinds: entryErrors }
      all.push(...entry.all)
      failed += entryFailed
      for (const [key, count] of entry.errors)
        errors[`${label}: ${key}`] = count
    }

    return { total: { ...summarize(all, seconds), errors: failed, errorRate: errorRate(failed, all.length) }, endpoints, errors }
  }
}

const errorRate = (failed, count) => count ? Math.round((failed / count) * 10_000) / 10_000 : 0
