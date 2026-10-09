#!/bin/sh
# Backs up colcom: a dump of the Postgres database and an archive of the git repos (DB_PATH), into
# BACKUP_DIR/colcom-<UTC time>/, keeping the newest BACKUP_KEEP backups. See README.md.
#
# Settings (environment): PGHOST, PGPORT, PGUSER, PGPASSWORD and PGDATABASE (libpq's; POSTGRES_HOST,
# POSTGRES_USER, POSTGRES_PASSWORD and POSTGRES_DB, the backend's, are used when they're unset),
# DB_PATH (required), BACKUP_DIR (default ./backups) and BACKUP_KEEP (default 14, 0 keeps all).
#
# POSIX sh with busybox's tools, so it runs in the postgres:18-alpine image as well as on a host.
set -eu

: "${DB_PATH:?Set DB_PATH to the git repos directory}"
export PGHOST="${PGHOST:-${POSTGRES_HOST:-localhost}}"
export PGUSER="${PGUSER:-${POSTGRES_USER:-postgres}}"
export PGDATABASE="${PGDATABASE:-${POSTGRES_DB:-colcom}}"
[ -z "${PGPASSWORD:-}" ] && [ -n "${POSTGRES_PASSWORD:-}" ] && export PGPASSWORD="$POSTGRES_PASSWORD"
BACKUP_DIR="${BACKUP_DIR:-./backups}"
BACKUP_KEEP="${BACKUP_KEEP:-14}"

[ -d "$DB_PATH" ] || { echo "DB_PATH \"$DB_PATH\" doesn't exist" >&2; exit 1; }
mkdir -p "$BACKUP_DIR"

# A backup is written under a .partial name and renamed when complete, so an interrupted one is never
# taken for a good one (nor counted by the retention below). Leftovers of earlier runs go first.
rm -rf "$BACKUP_DIR"/colcom-*.partial
name="colcom-$(date -u +%Y%m%dT%H%M%SZ)"
tmp="$BACKUP_DIR/$name.partial"
mkdir "$tmp"
trap 'rm -rf "$tmp"' EXIT

# Postgres first, then git. The backend writes a content's row before its git data and edits git
# before Postgres, and git only ever gains objects, so every commit and branch the dump refers to is
# already in git when it's archived. git may hold more (writes made meanwhile); after a restore,
# `checkConsistency.mjs --set-aside` puts those aside.
echo "Dumping database \"$PGDATABASE\" from $PGHOST:${PGPORT:-5432}"
pg_dump --format=custom --file="$tmp/postgres.dump"

# Each repo is copied to a snapshot, refs before objects: an object is written before any ref points
# to it, so copying every repo's refs first means every commit they name is in the snapshot, even
# while the backend writes. Lock files and git's temporary objects are half-done writes, left out.
echo "Archiving git repos from $DB_PATH"
snapshot="$tmp/git"
mkdir "$snapshot"

# Copies one entry of a repo, again if a file vanished meanwhile (a lock released, a temporary
# object renamed into place): what's copied is only ever newer
copy() {
  for attempt in 1 2 3 4 5; do
    rm -rf "$2/${1##*/}"
    if cp -R "$1" "$2/" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  echo "Couldn't copy $1" >&2
  return 1
}

for repo in "$DB_PATH"/*; do
  [ -f "$repo/HEAD" ] || continue
  mkdir "$snapshot/${repo##*/}"
  for entry in "$repo"/*; do
    [ "${entry##*/}" = objects ] || copy "$entry" "$snapshot/${repo##*/}"
  done
done
for repo in "$DB_PATH"/*; do
  [ -f "$repo/HEAD" ] || continue
  copy "$repo/objects" "$snapshot/${repo##*/}"
done
find "$snapshot" \( -name '*.lock' -o -name 'tmp_*' \) -exec rm -rf {} +
tar -czf "$tmp/git.tar.gz" -C "$snapshot" .
rm -rf "$snapshot"

(cd "$tmp" && sha256sum postgres.dump git.tar.gz > SHA256SUMS)
mv "$tmp" "$BACKUP_DIR/$name"
trap - EXIT
echo "Backup written to $BACKUP_DIR/$name ($(du -sh "$BACKUP_DIR/$name" | cut -f1))"

# Retention: the names sort by time, so all but the newest BACKUP_KEEP go
if [ "$BACKUP_KEEP" -gt 0 ]; then
  count=$(find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name 'colcom-*Z' | wc -l)
  if [ "$count" -gt "$BACKUP_KEEP" ]; then
    find "$BACKUP_DIR" -mindepth 1 -maxdepth 1 -type d -name 'colcom-*Z' | sort | head -n "$((count - BACKUP_KEEP))" | while read -r old; do
      echo "Removing old backup $old"
      rm -rf "$old"
    done
  fi
fi
