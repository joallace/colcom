#!/bin/sh
# Restores a backup made by backup.sh: recreates the database from its dump and replaces the
# contents of DB_PATH with its git archive. Stop the backend first. See README.md.
#
# Usage: restore.sh <backup directory> --yes
# Settings: the same as backup.sh's (PG*, or the backend's POSTGRES_*, and DB_PATH).
set -eu

backup="${1:-}"
if [ -z "$backup" ] || [ "${2:-}" != "--yes" ]; then
  echo "Usage: restore.sh <backup directory> --yes" >&2
  echo "Drops the database and deletes everything in DB_PATH before restoring; --yes confirms it." >&2
  exit 2
fi

: "${DB_PATH:?Set DB_PATH to the git repos directory}"
export PGHOST="${PGHOST:-${POSTGRES_HOST:-localhost}}"
export PGUSER="${PGUSER:-${POSTGRES_USER:-postgres}}"
[ -z "${PGPASSWORD:-}" ] && [ -n "${POSTGRES_PASSWORD:-}" ] && export PGPASSWORD="$POSTGRES_PASSWORD"
database="${PGDATABASE:-${POSTGRES_DB:-colcom}}"
unset PGDATABASE

echo "Verifying $backup"
(cd "$backup" && sha256sum -c SHA256SUMS)
mkdir -p "$DB_PATH"

# The database is recreated empty rather than cleaned, so nothing of the current one survives (a table
# the dump doesn't have, say), and the dump loads tables, then rows, then triggers, as it was taken
echo "Restoring database \"$database\" on $PGHOST:${PGPORT:-5432}"
psql --dbname=postgres --quiet -v ON_ERROR_STOP=1 \
  -c "DROP DATABASE IF EXISTS \"$database\" WITH (FORCE)" \
  -c "CREATE DATABASE \"$database\""
pg_restore --dbname="$database" --no-owner --exit-on-error "$backup/postgres.dump"

echo "Restoring git repos into $DB_PATH"
find "$DB_PATH" -mindepth 1 -maxdepth 1 -exec rm -rf {} +
tar -xzf "$backup/git.tar.gz" -C "$DB_PATH"
# The archive holds files only; git needs these directories even when they're empty
for repo in "$DB_PATH"/*/; do
  if [ -f "$repo/HEAD" ]; then
    mkdir -p "$repo/refs/heads" "$repo/refs/tags" "$repo/objects/info" "$repo/objects/pack"
  fi
done

echo "Restored. Next, with the backend's settings, set aside what git holds beyond the dump:"
echo "  node scripts/checkConsistency.mjs --set-aside --fsck"
