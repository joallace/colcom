#!/usr/bin/env bash
# Load tests the backend of a git revision under the same conditions as any other: builds it in a
# temporary worktree, starts a throwaway Postgres cluster and the built backend (node, as in Docker),
# runs index.mjs from this checkout against them, and removes everything afterwards.
#
#   scripts/loadtest/bench.sh <revision> <results.json> [index.mjs options, e.g. --duration 10]
#
# Ports: BENCH_API_PORT (3999) and BENCH_PG_PORT (5499). Postgres binaries come from PG_BIN or the
# newest /usr/lib/postgresql/*/bin.
set -euo pipefail

rev=${1:?usage: bench.sh <revision> <results.json> [options]}
out=$(realpath -m "${2:?usage: bench.sh <revision> <results.json> [options]}")
shift 2

here=$(cd "$(dirname "$0")" && pwd)
api_port=${BENCH_API_PORT:-3999}
pg_port=${BENCH_PG_PORT:-5499}
pg_bin=${PG_BIN:-$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)}
work=$(mktemp -d "${TMPDIR:-/tmp}/colcom-bench.XXXXXX")
server_pid=""

cleanup() {
  [[ -n $server_pid ]] && kill "$server_pid" 2>/dev/null && wait "$server_pid" 2>/dev/null || true
  "$pg_bin/pg_ctl" -D "$work/pg" -m fast stop >/dev/null 2>&1 || true
  git -C "$here" worktree remove --force "$work/src" 2>/dev/null || true
  rm -rf "$work"
}
trap cleanup EXIT

echo "[bench] building $rev in $work/src" >&2
git -C "$here" worktree add --detach --quiet "$work/src" "$rev"
(cd "$work/src/backend" && npm ci --no-audit --no-fund --loglevel=error >/dev/null && npm run build >/dev/null)

echo "[bench] starting Postgres on port $pg_port" >&2
"$pg_bin/initdb" -D "$work/pg" -U postgres --auth=trust >/dev/null
# The backend's pool takes up to 200 connections (DB_POOL)
"$pg_bin/pg_ctl" -D "$work/pg" -l "$work/pg.log" -w -o "-p $pg_port -c listen_addresses=localhost -c max_connections=250 -k $work" start >/dev/null
"$pg_bin/createdb" -h localhost -p "$pg_port" -U postgres colcom

echo "[bench] starting the backend on port $api_port" >&2
mkdir "$work/git"
(
  cd "$work/src/backend"
  export NODE_ENV=production PORT=$api_port PINO_LOG_LEVEL=warn DB_PATH="$work/git" \
    ACCESS_TOKEN_SECRET=bench-secret-that-is-at-least-32-characters-long \
    POSTGRES_USER=postgres POSTGRES_PASSWORD=bench POSTGRES_HOST=localhost PGPORT=$pg_port POSTGRES_DB=colcom \
    RATE_LIMIT_LOGIN=off RATE_LIMIT_SIGN_UP=off RATE_LIMIT_CONTENTS=off RATE_LIMIT_INTERACTIONS=off \
    GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1 \
    GIT_AUTHOR_NAME=colcom GIT_AUTHOR_EMAIL=admin@colcom.bench GIT_COMMITTER_NAME=colcom GIT_COMMITTER_EMAIL=admin@colcom.bench
  exec node build/src/server.js
) >"$work/server.log" 2>&1 &
server_pid=$!

# init.sql runs on the first connection; /topics answers once the tables exist
for _ in $(seq 100); do
  curl -sf "http://localhost:$api_port/topics" >/dev/null && break
  kill -0 "$server_pid" 2>/dev/null || { cat "$work/server.log" >&2; exit 1; }
  sleep 0.2
done

node "$here/index.mjs" --api "http://localhost:$api_port" --db-path "$work/git" --server-pid "$server_pid" \
  --label "$(git -C "$here" log -1 --format='%h %s' "$rev")" --out "$out" "$@"

if grep -qiE '"level":(50|60)' "$work/server.log"; then
  echo "[bench] the backend logged errors:" >&2
  grep -iE '"level":(50|60)' "$work/server.log" | head -5 >&2
fi
