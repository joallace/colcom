# Backups

colcom keeps its data in two places that must be backed up together: Postgres (users, contents, votes, the vote log) and the git repos, one per topic, which hold every version of every text and are the tamper-evident record. In Docker they are the `postgres_data` and `git_data` volumes.

| File | What it does |
|---|---|
| `backup.sh` | Dumps the database (`pg_dump --format=custom`) and archives the repos into `BACKUP_DIR/colcom-<UTC time>/` (`postgres.dump`, `git.tar.gz`, `SHA256SUMS`), then deletes all but the newest `BACKUP_KEEP` (default 14; 0 keeps all) |
| `restore.sh` | Checks the checksums, recreates the database from the dump and replaces everything in `DB_PATH` with the archive |
| `../checkConsistency.mjs` | Compares Postgres with git (`npm run check:consistency`); `--set-aside` moves branches with no row out of the way |
| `../../../backup-service.yml` | A compose service (the `postgres:18-alpine` image) that runs both scripts against the compose volumes |

Both scripts are POSIX `sh` and read libpq's `PGHOST`, `PGPORT`, `PGUSER`, `PGPASSWORD` and `PGDATABASE` (or the backend's `POSTGRES_*`) and `DB_PATH`.

## How a backup stays consistent while the site is up

Postgres and git can't be snapshotted in one transaction, so the order matters. The database is dumped first, then the repos are copied, each repo's refs before its objects. The backend writes a content's row before its branch, edits git before Postgres, and git only ever gains objects, so everything the dump refers to is in the archive. The archive may hold more: posts, suggestions and topics created between the dump and the copy, and edits whose summary in Postgres is older. `checkConsistency.mjs --set-aside` handles the first after a restore (see below); the second is harmless, since git's text is what readers see.

## Making backups

With Docker, from the repository root:

```sh
docker compose -f docker-compose.yml -f backup-service.yml run --rm backup
```

Backups go to `./backups` (`BACKUP_HOST_DIR` in `.env` changes it), owned by root. To make one every night at 03:00, add to the host's crontab:

```
0 3 * * * cd /path/to/colcom && docker compose -f docker-compose.yml -f backup-service.yml run --rm backup >> backups/backup.log 2>&1
```

Copies on the same disk don't survive the disk: also copy `backups/` to another machine (`rsync`, `rclone`, a storage bucket). They hold every user's email address and password hash, so keep them private.

Without Docker, run the script with the backend's settings: `DB_PATH=… PGPORT=… BACKUP_DIR=… sh backend/scripts/backup/backup.sh`. Its `pg_dump` must be as new as the server.

## Restoring

1. Stop the backend, so nothing writes during the restore: `docker compose stop backend`.
2. Restore. This drops the database and empties the repos volume:
   ```sh
   docker compose -f docker-compose.yml -f backup-service.yml run --rm backup /scripts/restore.sh /backups/colcom-20261009T030000Z --yes
   ```
3. Set aside what git holds beyond the dump, and check the repos, before anyone writes:
   ```sh
   docker compose run --rm --no-deps backend node scripts/checkConsistency.mjs --set-aside --fsck
   ```
   The posts and suggestions made between the dump and the archive have branches but no rows. Their ids will be handed out again, and the backend refuses to create a branch that already exists, so `--set-aside` moves each of them to `refs/orphaned/<time>/<name>` in its repo: nothing is deleted, and they can still be read with `git log`. It exits with 1 when it reported something; run it again without `--set-aside` to confirm it now says "Postgres and git agree".
4. Start the backend: `docker compose start backend`.

An image built before the check existed lacks it: `docker compose build backend` first.

## Checking consistency at any time

`npm run check:consistency` in `backend/` (or `docker compose exec backend node scripts/checkConsistency.mjs`) reports, and exits with 1 on any:

| Kind | Meaning |
|---|---|
| `topic-without-repo`, `topic-without-main` | A topic row whose repo, or its `main` branch, is missing |
| `post-without-branch` | A post row with no branch in its topic's repo |
| `suggestion-without-branch`, `suggestion-commit-mismatch`, `suggestion-without-commit` | A suggestion whose `<postId>_<interactionId>` branch is missing or elsewhere than Postgres recorded, or whose write never finished |
| `critique-commit-missing` | A critique quoting a commit its post's repo doesn't have |
| `branch-without-post`, `branch-without-suggestion`, `repo-without-topic` | git data with no row: set aside by `--set-aside` |
| `unknown-branch`, `unknown-entry`, `post-without-topic`, `suggestion-without-post` | Anything else out of place |

`--fsck` also runs `git fsck` on every repo, and `--json` prints the result as JSON. Rows without git data are only reported: they come from a write interrupted between Postgres and git, and need a person to decide. While the site is up, a write in progress can show up for a moment; run it again before acting.
