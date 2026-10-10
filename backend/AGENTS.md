# colcom backend

Express 5 + TypeScript 7 API over PostgreSQL and per-topic git repositories. Read the root [`AGENTS.md`](../AGENTS.md) first for what colcom is and how data is split between git and Postgres.

## Layout

| Path | What it holds |
|---|---|
| `src/app.ts` | App setup: trust proxy, CORS, JSON body parser, routers, JSON 404, error handler |
| `src/server.ts` | Starts listening and, once `init.sql` has run (`ready` from `pgDatabase.ts`), opens what's missing of the meta space (`ensureMeta`) and indexes for search what isn't yet (`indexUnindexed`); kept apart so tests import the app without binding a port |
| `src/searchIndex.ts` | `indexUnindexed`: fills `search_text` for rows written before search existed (or restored from such a backup), a post's from its branch tip; nothing to do once all are indexed |
| `src/meta.ts`, `src/metaTopics.ts` | The meta space: the system account, the reserved "meta" tag and the foundational topics, defined (groups, titles, Portuguese bodies, answers) in `metaTopics.ts`. `ensureMeta` changes nothing when all is there; `test/unit/meta.test.ts` checks every body against the `topic` schema |
| `src/routes/*.ts` | Route → middleware → controller wiring |
| `src/controllers/*.ts` | Request handling, validation, orchestration of models and git. Models return data or outcomes, never HTTP statuses: `Interactions.toggle` says whether it `created`, `updated` or `removed`, and the controller answers 201, 200 or 204 |
| `src/models/*.ts` | All SQL; controllers call named functions (`Content.findBookmarked`, `Interactions.pendingSuggestions`…) and never pass SQL. `content.ts` has the lists (built on `findAll` and `findTree`) and `summarize`; `interactions.ts` has votes, bookmarks and suggestions; `notifications.ts` has `notify` and the inbox; `tags.ts` has tag votes, search, intersections and the `tagFilterSql`/`topicTagsSql` fragments; `search.ts` has the full-text search; `sql.ts` has `queryParams` and the fragments several models share |
| `src/gitDatabase.ts` | Every git command (the only place that runs git) |
| `src/pgDatabase.ts` | Connection pool; runs `sql/init.sql` on first connect (exits if it fails) |
| `src/config.ts` | Settings from the environment; the server refuses to start without `ACCESS_TOKEN_SECRET` (32+ chars) or with a malformed `RATE_LIMIT_*` or `TAG_*` |
| `src/middleware/rateLimit.ts` | Rate limiters for login, sign-up, content writes and interactions |
| `src/validation.ts` | `validate(schema, data)`: checks a request's body, query or params against the shared schemas (`shared/`) and returns the validated copy, typed by the schema (`SchemaData` in `shared/index.d.ts`) |
| `src/pagination.ts` | `orderByColumn` whitelist and `limitOffset` clamping |
| `src/errors.ts` | Error classes (`ValidationError` 400, `ForbiddenError` 403, `NotFoundError` 404, `ConflictError` 409…); messages and `action` hints in Portuguese |

Imports use the `@/` alias (`tsconfig` paths, rewritten by `tsc-alias` at build). `npm run build` also copies `sql/` into `build/`.

## The git layer (`gitDatabase.ts`)

- **Layout:** one bare repo per topic at `DB_PATH/<topicId>`. Branch `main` holds the topic; each post is a branch named by its id; suggestions are branches `<postId>_<interactionId>`. The single file is `main.html`.
- **One block per line:** `formatHtml` puts each block element (paragraph, heading, list item…) on its own line before committing. The editor emits a whole document as one line, and without this any two edits conflict. The browser's parser ignores this whitespace, so documents and critique positions are unaffected; code blocks are left untouched.
- **Writes without a working tree:** there's no checkout, index or lock. A write stores objects (`hash-object -w`, `mktree`, `commit-tree`; merges with `merge-tree --write-tree`, hence git ≥ 2.38, checked at startup) and then moves one branch with `update-ref <ref> <new> <old>`, a compare-and-swap. Objects are content addressed, so concurrent writes can't disturb each other, and a failed write leaves nothing to clean up.
- **Races:** new branches (posts, suggestions, clones) are created only if absent. Edits and merges go through `advance()`, which queues the process' writes per branch (`queued`, an in-memory promise chain; branches never wait on each other) so they don't race. The compare-and-swap stays as the guard against writers outside the queue: if the branch moved anyway, the commit is rebuilt on the new tip after a random, growing delay, up to 20 times before a 409. Without the queue, 64 people editing one post made 21% of edits give up (load test). An edit sends the whole text, so of two concurrent edits the last to land decides it.
- **Validated hashes:** every hash that comes from a request goes through `validateCommit` (`^[0-9a-f]{7,40}$`), because a value like `--output=…` would be read as a git option. Full 40-character hashes are stored everywhere.
- **Read helpers:**
  - `isInHistory`: is a commit part of `main..<post>`, i.e. the post's own timeline?
  - `mergeBase`: the commit a suggestion branched from.
  - `firstParentHistory`: a version's ancestors along the post's line, where a merged suggestion counts as one step.
  - `ancestors`: every commit a version descends from.
  - `log`: the timeline, parsed from NUL-separated `git log -z`, since NUL is the one character commit messages can't contain.
- **Edits:** an edit with no changes is refused with a 400 before committing.
- **Merges:** `merge` tries `merge-tree --write-tree` first. git also refuses changes on adjacent lines, so on its exit status 1 the three texts (`sides`: the post's tip, the merge base and the suggestion) go through `cleanMerge` (`shared/src/merge.js`), which only refuses changes to the same lines; then it's a 409 `GIT:MERGE:CONFLICT`. A `resolution` (`{ body, head }`, from the author's resolution page) is committed as the merge's tree only if the post's tip is still `head`, or it's a 409 `GIT:MERGE:HEAD_MOVED`. Every merge has the post and the suggestion as parents, and `mergePost` then updates the post's summary from the merged text.

## Query patterns

- **No N+1 queries.** `findTree` (behind `findTopics`, `findTopic`, `findTopicsByIds` and `findTopicsByTitle`) returns a page of topics with their posts ranked (most poll votes, then up votes, then oldest), cropped to `childLimit`, statistics over all posts (`childrenStats`: up, down and poll votes, critiques and suggestions summed over them, with each answer's post `count` and poll `votes` under `answers`, which the grouped view needs since lists only send the top posts), and the viewer's interactions and poll vote, in one query. `findAll` (behind `findById`, `findList`, `findBookmarked` and `critiquesOf`) takes `userPid` (adds `userInteractions`) and `withTotal` (adds `COUNT(*) OVER ()` as `total_count`). The shared fragments in `models/sql.ts` (`userInteractionsSql`, `interactionCountSql`, `promotionCountSql`, `promotionValidSql`…) keep them consistent; reuse them rather than querying per row.
- **Always parameterize.** `ORDER BY` can't be parameterized, so sort keys go through `orderByColumn` with a whitelist. `page`/`pageSize` go through `limitOffset`.
- **Count parameters exactly.** Postgres refuses a parameter the query doesn't use, so optional parameters (like `userPid`) are only added when the SQL uses them. Build them with `queryParams()` (`models/sql.ts`): `add(value, cast?)` appends a value and returns its `$n`, so nobody numbers parameters by hand. `findAll` and `findTree` take a filter, `params => condition`, built that way inside the model.
- **Avatars:** `bytea`, sent as base64. Inside JSON built by SQL, use `AVATAR_BASE64` (strips the line breaks `encode` adds).
- **Schema changes:** edit `init.sql` (idempotent `IF NOT EXISTS` statements). There is no production data yet, so no migrations.
- **Vote log:** `vote_events` is filled by the `interactions_vote_events` trigger, not by models, so any statement on a `vote` row is logged in its own transaction. Triggers make it append-only.
- **Tags:** the same pattern. Models only write `tag_votes`; the `tag_votes_apply` trigger logs the vote in `tag_events` (append-only, `reject_log_change`) and recounts the tag's `contents_tags` row, locking it first so concurrent votes on one tag count each other. `contents_tags.visible` is a generated column (endorsements ≥ 1 and ≥ contests), and the filters use its partial index. Activation (`tags.activated_at`) is set by `Tags.activate` after each vote, since its threshold is a setting; expiry is never stored, but computed from a provisional tag's age (`expiredSql`). Every topic in `findTree` carries its `tags` (`topicTagsSql`, with the viewer's `userVote`), still in one query. A new topic's tags are checked before the content is inserted and written after git succeeds (`prepareTopicTags`/`applyTopicTags`), since the log can't be rolled back.
- **Notifications:** controllers call `notify()` (`models/notifications.ts`) once an action's Postgres and git writes have both succeeded, so a notification never points to something rolled back. Its recipient comes from SQL (`recipientOf`: the author of what it's about, or the suggester for an answer to a suggestion), and a `CHECK` keeps anyone from being told about their own action. A failed notification is logged and doesn't fail the action. A new kind of event (phase 2's critique answers and disputes) is a new `NotificationType`, a `recipientOf` entry and a case in the frontend's `describeNotification`.
- **Unique indexes:** they prevent duplicate up/down votes, bookmarks and poll votes; a racing duplicate insert becomes a 409.
- **Search:** `Content.create` takes the whole body (it stores a post's summary itself) and, with `updateById` (edits, merges, clones), writes `search_text`, the body's `plainText`. So every write of a post's text goes through one of them, or search goes stale. `tag_names` is kept by the `tag_votes` trigger (`refresh_tag_names`), and a new post starts with its topic's (`topic_tag_names`). The generated `search` column weighs title (A), tags (B) and text (D) with the `colcom` configuration, under a GIN index. `Search.search` ranks with `ts_rank` normalised by length, pages, and only then runs `ts_headline` (it parses the text again) for each hit's `excerpt`, whose matched words are between U+E000 and U+E001 (`plainText` removes those from the text, so they can't be forged). Queries are read by `websearch_to_tsquery`: words, `"phrases"`, `or` and `-exclusions`. Content rows are returned with `RETURNED_COLUMNS`, never `*`, so the search columns stay out of responses.

## Security rules

- **Auth:** `authHandler()` (required) or `authHandler(true)` (optional) verifies the JWT and puts the user in `res.locals.user` (`{ username, email, pid }`). Never read the user from `req.params`.
- **Sessions:** tokens last 7 days and carry the user's `token_version` (claim `ver`); `authHandler` compares it with the current one (one query by `pid`) and answers a 401 "Sessão encerrada." when they differ. `POST /logout` raises the version, so it ends every session of the user, on every device. An optional route without a token is served anonymously, but one with an invalid, expired or revoked token gets a 401 too, so the client logs out instead of taking anonymous data as its own.
- **Ownership:** only a post's author merges or rejects its suggestions (`findOwnedSuggestion` checks the post, the author and that the hash is a *pending* suggestion of that post). State-changing routes use POST/PATCH, never GET.
- **Rate limits:** failed logins and sign-ups count per IP; content writes (`POST /contents`, `PATCH /contents/:id`, clone) and `POST /interactions` count per user, so the limiter goes after `authHandler`. Limits are `RATE_LIMIT_*` settings (`.env.example`); over one, the API answers a 429 `TooManyRequestsError`. Counts live in memory, so they reset on restart and assume a single backend process. `req.ip` comes from `X-Forwarded-For` only through proxies `TRUST_PROXY` trusts (default `loopback`, i.e. nginx on the same host).
- **CORS:** only the origins in `CORS_ORIGIN` (comma-separated); outside production, with none set, the Vite dev server. Through nginx the site and API share an origin and need no CORS.
- **Errors:** throw the classes from `errors.ts` (each only sets a default status, message and action; every one takes every field, and the stack is captured where it's created). Handlers don't catch to call `next`: Express 5 sends a rejected async handler's error to `errorHandler`; catch only to roll back, log or turn one error into another. `findContentOrThrow`/`contentNotFound` (`controllers/content.ts`) make the usual 404s. `errorHandler` returns only `BaseError`s (without stack); anything else (e.g. a pg error with table names) becomes a generic 500 with an `errorId`, and the full error is logged.
- **Validate every input.** Controllers pass `req.body`, `req.query` and `req.params` through `validate` (`src/validation.ts`) before using them, and use what it returns: Express 5 parses `req.query` again on each access, so changes to it are lost. A failure is a 400 `ValidationError` whose `message` and `key` name the first problem and whose `errors` list all of them (`{ key, label, message }`), which the forms show by field.
- **Critique anchors:** the `critique` schema checks the shape and strips unknown keys; `validateCritiqueCommit` requires the commit to be in the post's own history.

## API

| Method and path | Auth | Purpose |
|---|---|---|
| `POST /users`, `POST /login` | — | Sign up; log in (returns `accessToken`) |
| `POST /logout` | required | Revokes every token of the user (204) |
| `GET /users/self` | required | Current user, with the topic they're promoting |
| `GET /users/:name` | — | Anyone's public profile (`pid`, `name`, `avatar`, `created_at`), by name ignoring case; registered after `/users/self`, so "self" is a reserved name |
| `GET /topics?page&pageSize&orderBy&with_count&tags` | optional | Topic list, each with its top 3 posts, stats and `tags`; `tags=a,b` keeps those having all of them (none when one doesn't exist) |
| `GET /topics/:id` | optional | One topic with all its posts ranked; 404 for non-topics |
| `GET /contents?authorId&page&pageSize` | optional | A user's contents, for the profile: `{ contents, count }` |
| `GET /contents/bookmarked?page&pageSize` | required | The user's bookmarks, same shape |
| `POST /contents` | required | Create a topic, post or critique (the type follows from the parent's depth); a topic takes `tags`, a list of names |
| `GET /contents/:id` | optional | A content; for posts, `history`, `interactionCounts` (poll `votes`, the topic's `topicVotes`, `suggestions` in any state and `critiques`), `userTopicVote` (the post the viewer voted for in the topic, or null; logged in only) and (for the author) pending `suggestions` |
| `GET /contents/:id/:hash` | optional | A post version: `body`, `critiques` made on it or earlier, `versions` and `lineages` (see below), and `base` for a pending suggestion |
| `PATCH /contents/:id` | required | Edit a post: a commit for the author, a suggestion for anyone else |
| `POST /contents/:id/:hash/merge` and `/reject` | required | The author accepts or rejects a pending suggestion. A merge without a body is automatic (409 `GIT:MERGE:CONFLICT` when both changed the same lines); with `{ body, head }` (the `resolution` schema) it commits the author's resolution, 409 `GIT:MERGE:HEAD_MOVED` if the post changed since `head` |
| `GET /contents/:id/:hash/merge` | required | For the post's author, what resolving a pending suggestion needs: `{ head, base, suggestion }`, each `{ commit, body }` |
| `POST /contents/:id/:hash/clone` | required | New post branched from that version |
| `POST /interactions` | required | Toggle `up`/`down`/`vote`/`bookmark`/`promote`; 404 for a missing content, 400 for a poll vote on anything but a post |
| `GET /notifications?page&pageSize&unread` | required | The user's notifications, newest first: `{ notifications, count, unread }`, each with `type`, `read`, `actor`, `content` (the post or topic it's about), `topic_id`, `subject` (the critique, post or clone made) and `suggestion` |
| `GET /notifications/unread` | required | `{ unread }`, what the navbar polls |
| `POST /notifications/read` | required | Marks `{ ids }`, or all without them, as read; only the user's own. Returns `{ read, unread }` |
| `GET /tags?q&page&pageSize` | — | Tags whose slug contains `q` (those starting with it first, then the most used): `{ tags, count }`, each with `slug`, `name`, `provisional` and `topics`. Aliases, expired and reserved tags are left out |
| `GET /tags/:slugs` | — | One tag or an intersection (`a,b`): `{ tags, canonical, topics, related }`; `canonical` is the list with aliases replaced, `related` the tags those topics have most. 404 when a tag doesn't exist or expired |
| `POST /topics/:id/tags` | required | `{ tag, value }`: endorse (1), contest (-1) or withdraw (0); endorsing a tag the topic lacks proposes it, one that doesn't exist creates it. 403 for accounts in probation (except on their own topics), creating one too early or any vote on a reserved tag, 429 over the daily creation limit. Returns the topic's `tags` |
| `GET /search?q&type&tags&page&pageSize` | optional | Topics and posts (`type=topic\|post` for one of them) whose title, tags or text match `q`, most relevant first: `{ results, count }`, each as `GET /contents` lists it, with an `excerpt` of its text marking the matched words. `tags=a,b` keeps those of topics having all of them |
| `GET /meta` | optional | The foundational topics in their groups and order: `{ groups: [{ key, name, description, topics }] }`, each topic as `GET /topics` sends it; a group's `topics` are empty before the first start |
| `GET /topics/:id/tags/history` | — | The topic's `tag_events`, oldest first: `{ id, voter, tag, name, from, to, created_at }`, voters numbered per topic |
| `GET /topics/:id/votes` | — | The poll's history from `vote_events`, oldest first: `{ id, voter, from, to, created_at }`, with voters numbered per topic (not named until sign-up asks consent for public votes) |

`lineages` maps each earlier version that critiques were made on to the list of commits from it to the requested one, along the post's first-parent history. `versions` holds the text of every commit in those lists. The frontend follows each critiqued passage through those edits (see `frontend/AGENTS.md`).

Lists that include topics (`toFeed`) return topics with their posts, posts with `topic: { id, title }`, and critiques with `post: { id, title }` and `topic: { id }`.

## Tests

`npm test` runs both Vitest projects; `npm run test:unit` and `npm run test:integration` run one. See the root `AGENTS.md` for how the database is provided.

- **Integration tests go through the API** with the helpers in `test/support/api.ts` (`signUp`, `createTopic`, `createPost`, `edit`, `critique`, `interact`…), never through models directly, so routing, auth, SQL and git are exercised together.
- **Rate limits are off in tests** (`vitest.config.ts`), since helpers sign up many users from one address. `rateLimit.test.ts` turns them on with low values and acts as different clients through `X-Forwarded-For`. Likewise new accounts may create tags (`TAG_MIN_ACCOUNT_DAYS=0`); `tagLimits.test.ts` uses the defaults and ages users with SQL, and `tags.test.ts` raises the daily creation limit.
- **Data is per file, not per test.** Tests in a file share a database, so make what each test needs (helpers generate unique names and titles) and don't assume a table is empty; a test that counts everything goes in its own file (e.g. `topics.test.ts`).
- **Unit tests import modules directly.** Mock `@/pgDatabase` (`vi.mock`) when a module under test imports it, or the pool will try to connect.

## Load tests (`scripts/loadtest/`)

Not part of `npm test`: they take minutes and measure the machine as much as the code. Run them when a change touches the git layer, the queries or anything else on the request path, and compare against the commit before it.

- **Compare two revisions:** `npm run loadtest:bench -- <rev> <out.json> [options]` builds the backend of `<rev>` in a temporary worktree and runs it with `node` (as in Docker) against a throwaway Postgres cluster (ports 3999 and 5499, `BENCH_API_PORT`/`BENCH_PG_PORT`), with the rate limits off; the load test itself always comes from the current checkout. Run each side a few times, interleaved, then `npm run loadtest:compare -- --before a1.json,a2.json --after b1.json,b2.json` prints a Markdown table of medians.
- **Against a running backend:** `npm run loadtest -- --api <url> [--db-path <DB_PATH>] [--server-pid <pid>]`, which must have every `RATE_LIMIT_*` off. It adds 80 users and about 70 topics, so never point it at an instance with real people. `--db-path` enables the git checks and `--server-pid` the CPU (the backend's and its git processes') and memory figures.
- **Options:** `--scenarios a,b`, `--concurrency 1,4,16,64` (virtual users), `--duration 15` and `--warmup 3` (seconds per phase), `--out results.json`.
- **Scenarios** (`scenarios.mjs`) are closed loops: each virtual user sends its next request when the previous one is answered. `read` mixes the four read paths; the write scenarios differ in what concurrent writes share: one branch (`edit-same-post`), one repo with a branch per writer (`edit-same-topic`, `suggest-merge`, `create-posts`), or a repo per writer (`edit-many-topics`); `mixed` is mostly reads with some votes, edits and critiques.
- **Integrity** (`integrity.mjs`) runs after the load: `fsck` and no leftover `.lock` files in every repo, every acknowledged commit in its branch and exactly as many commits on each post's line as were acknowledged (lost or phantom writes), a branch for every post row and the reverse, every suggestion branch where the API said, and Postgres' summary equal to the branch tip's first paragraph. Its `summarize` is a copy of the backend's, kept in step by `test/unit/loadtest.test.ts`.

## Backups and consistency (`scripts/backup/`, `scripts/checkConsistency.mjs`)

`backup.sh` dumps Postgres, then copies the repos (refs before objects), so the archive holds everything the dump refers to; `restore.sh` puts both back. `checkConsistency.mjs` (`npm run check:consistency`) compares rows with repos and branches both ways and exits with 1 on any mismatch; `--set-aside` moves branches with no row to `refs/orphaned/`, needed after a restore since their ids will be reused. A change to the git layout (branch names, repo per topic) must be mirrored there; `test/integration/consistency.test.ts` covers it. Guide: `scripts/backup/README.md`.
