# colcom backend

Express 5 + TypeScript 7 API over PostgreSQL and per-topic git repositories. Read the root [`AGENTS.md`](../AGENTS.md) first for what colcom is and how data is split between git and Postgres.

## Layout

| Path | What it holds |
|---|---|
| `src/app.ts` | App setup: trust proxy, CORS, JSON body parser, routers, JSON 404, error handler |
| `src/server.ts` | Starts listening; kept apart so tests import the app without binding a port |
| `src/routes/*.ts` | Route → middleware → controller wiring |
| `src/controllers/*.ts` | Request handling, validation, orchestration of models and git |
| `src/models/*.ts` | All SQL. `content.ts` has `findAll`, `findTree`, `summarize`; `interactions.ts` has votes, bookmarks and suggestions; `notifications.ts` has `notify` and the inbox |
| `src/gitDatabase.ts` | Every git command (the only place that runs git) |
| `src/pgDatabase.ts` | Connection pool; runs `sql/init.sql` on first connect (exits if it fails) |
| `src/config.ts` | Settings from the environment; the server refuses to start without `ACCESS_TOKEN_SECRET` (32+ chars) or with a malformed `RATE_LIMIT_*` |
| `src/middleware/rateLimit.ts` | Rate limiters for login, sign-up, content writes and interactions |
| `src/validation.ts` | `validate(schema, data)`: checks a request's body, query or params against the shared schemas (`shared/`) and returns the validated copy |
| `src/pagination.ts` | `orderByColumn` whitelist and `limitOffset` clamping |
| `src/errors.ts` | Error classes; messages and `action` hints in Portuguese |

Imports use the `@/` alias (`tsconfig` paths, rewritten by `tsc-alias` at build). `npm run build` also copies `sql/` into `build/`.

## The git layer (`gitDatabase.ts`)

- **Layout:** one bare repo per topic at `DB_PATH/<topicId>`. Branch `main` holds the topic; each post is a branch named by its id; suggestions are branches `<postId>_<interactionId>`. The single file is `main.html`.
- **One block per line:** `formatHtml` puts each block element (paragraph, heading, list item…) on its own line before committing. The editor emits a whole document as one line, and without this any two edits conflict. The browser's parser ignores this whitespace, so documents and critique positions are unaffected; code blocks are left untouched.
- **Writes without a working tree:** there's no checkout, index or lock. A write stores objects (`hash-object -w`, `mktree`, `commit-tree`; merges with `merge-tree --write-tree`, hence git ≥ 2.38, checked at startup) and then moves one branch with `update-ref <ref> <new> <old>`, a compare-and-swap. Objects are content addressed, so concurrent writes can't disturb each other, and a failed write leaves nothing to clean up.
- **Races:** new branches (posts, suggestions, clones) are created only if absent. Edits and merges go through `advance()`: if another write moved the branch first, the commit is rebuilt on the new tip after a random, growing delay, up to 20 times before a 409. An edit sends the whole text, so of two racing edits the last to land decides it, as before.
- **Validated hashes:** every hash that comes from a request goes through `validateCommit` (`^[0-9a-f]{7,40}$`), because a value like `--output=…` would be read as a git option. Full 40-character hashes are stored everywhere.
- **Read helpers:**
  - `isInHistory`: is a commit part of `main..<post>`, i.e. the post's own timeline?
  - `mergeBase`: the commit a suggestion branched from.
  - `firstParentHistory`: a version's ancestors along the post's line, where a merged suggestion counts as one step.
  - `ancestors`: every commit a version descends from.
  - `log`: the timeline, parsed from NUL-separated `git log -z`, since NUL is the one character commit messages can't contain.
- **Edits:** an edit with no changes is refused with a 400 before committing.

## Query patterns

- **No N+1 queries.** `findTree` returns a page of topics with their posts ranked (most poll votes, then up votes, then oldest), cropped to `childLimit`, statistics over all posts (`childrenStats`, with each answer's post `count` and poll `votes` under `answers`, which the grouped view needs since lists only send the top posts), and the viewer's interactions and poll vote, in one query. `findAll` takes `userPid` (adds `userInteractions`) and `withTotal` (adds `COUNT(*) OVER ()` as `total_count`). The shared `userInteractionsSql` fragment keeps both consistent; reuse it rather than querying per row.
- **Always parameterize.** `ORDER BY` can't be parameterized, so sort keys go through `orderByColumn` with a per-query whitelist. `page`/`pageSize` go through `limitOffset`.
- **Count parameters exactly.** Postgres refuses a parameter the query doesn't use, so optional parameters (like `userPid`) are only added when the SQL uses them.
- **Avatars:** `bytea`, sent as base64. Inside JSON built by SQL, use `AVATAR_BASE64` (strips the line breaks `encode` adds).
- **Schema changes:** edit `init.sql` (idempotent `IF NOT EXISTS` statements). There is no production data yet, so no migrations.
- **Vote log:** `vote_events` is filled by the `interactions_vote_events` trigger, not by models, so any statement on a `vote` row is logged in its own transaction. Triggers make it append-only.
- **Notifications:** controllers call `notify()` (`models/notifications.ts`) once an action's Postgres and git writes have both succeeded, so a notification never points to something rolled back. Its recipient comes from SQL (`recipientOf`: the author of what it's about, or the suggester for an answer to a suggestion), and a `CHECK` keeps anyone from being told about their own action. A failed notification is logged and doesn't fail the action. A new kind of event (phase 2's critique answers and disputes) is a new `NotificationType`, a `recipientOf` entry and a case in the frontend's `describeNotification`.
- **Unique indexes:** they prevent duplicate up/down votes, bookmarks and poll votes; a racing duplicate insert becomes a 409.

## Security rules

- **Auth:** `authHandler()` (required) or `authHandler(true)` (optional) verifies the JWT and puts the user in `res.locals.user` (`{ username, email, pid }`). Never read the user from `req.params`.
- **Ownership:** only a post's author merges or rejects its suggestions (`findOwnedSuggestion` checks the post, the author and that the hash is a *pending* suggestion of that post). State-changing routes use POST/PATCH, never GET.
- **Rate limits:** failed logins and sign-ups count per IP; content writes (`POST /contents`, `PATCH /contents/:id`, clone) and `POST /interactions` count per user, so the limiter goes after `authHandler`. Limits are `RATE_LIMIT_*` settings (`.env.example`); over one, the API answers a 429 `TooManyRequestsError`. Counts live in memory, so they reset on restart and assume a single backend process. `req.ip` comes from `X-Forwarded-For` only through proxies `TRUST_PROXY` trusts (default `loopback`, i.e. nginx on the same host).
- **CORS:** only the origins in `CORS_ORIGIN` (comma-separated); outside production, with none set, the Vite dev server. Through nginx the site and API share an origin and need no CORS.
- **Errors:** throw the classes from `errors.ts`. `errorHandler` returns only `BaseError`s (without stack); anything else (e.g. a pg error with table names) becomes a generic 500 with an `errorId`, and the full error is logged.
- **Validate every input.** Controllers pass `req.body`, `req.query` and `req.params` through `validate` (`src/validation.ts`) before using them, and use what it returns: Express 5 parses `req.query` again on each access, so changes to it are lost. A failure is a 400 `ValidationError` whose `message` and `key` name the first problem and whose `errors` list all of them (`{ key, label, message }`), which the forms show by field.
- **Critique anchors:** the `critique` schema checks the shape and strips unknown keys; `validateCritiqueCommit` requires the commit to be in the post's own history.

## API

| Method and path | Auth | Purpose |
|---|---|---|
| `POST /users`, `POST /login` | — | Sign up; log in (returns `accessToken`) |
| `GET /users/self` | required | Current user, with the topic they're promoting |
| `GET /users/:name` | — | Anyone's public profile (`pid`, `name`, `avatar`, `created_at`), by name ignoring case; registered after `/users/self`, so "self" is a reserved name |
| `GET /topics?page&pageSize&orderBy&with_count` | optional | Topic list, each with its top 3 posts and stats |
| `GET /topics/:id` | optional | One topic with all its posts ranked; 404 for non-topics |
| `GET /contents?authorId&page&pageSize` | optional | A user's contents, for the profile: `{ contents, count }` |
| `GET /contents/bookmarked?page&pageSize` | required | The user's bookmarks, same shape |
| `POST /contents` | required | Create a topic, post or critique (the type follows from the parent's depth) |
| `GET /contents/:id` | optional | A content; for posts, `history` and (for the author) pending `suggestions` |
| `GET /contents/:id/:hash` | optional | A post version: `body`, `critiques` made on it or earlier, `versions` and `lineages` (see below), and `base` for a pending suggestion |
| `PATCH /contents/:id` | required | Edit a post: a commit for the author, a suggestion for anyone else |
| `POST /contents/:id/:hash/merge` and `/reject` | required | The author accepts or rejects a pending suggestion |
| `POST /contents/:id/:hash/clone` | required | New post branched from that version |
| `POST /interactions` | required | Toggle `up`/`down`/`vote`/`bookmark`/`promote`; 404 for a missing content, 400 for a poll vote on anything but a post |
| `GET /notifications?page&pageSize&unread` | required | The user's notifications, newest first: `{ notifications, count, unread }`, each with `type`, `read`, `actor`, `content` (the post or topic it's about), `topic_id`, `subject` (the critique, post or clone made) and `suggestion` |
| `GET /notifications/unread` | required | `{ unread }`, what the navbar polls |
| `POST /notifications/read` | required | Marks `{ ids }`, or all without them, as read; only the user's own. Returns `{ read, unread }` |
| `GET /topics/:id/votes` | — | The poll's history from `vote_events`, oldest first: `{ id, voter, from, to, created_at }`, with voters numbered per topic (not named until sign-up asks consent for public votes) |

`lineages` maps each earlier version that critiques were made on to the list of commits from it to the requested one, along the post's first-parent history. `versions` holds the text of every commit in those lists. The frontend follows each critiqued passage through those edits (see `frontend/AGENTS.md`).

Lists that include topics (`toFeed`) return topics with their posts, posts with `topic: { id, title }`, and critiques with `post: { id, title }` and `topic: { id }`.

## Tests

`npm test` runs both Vitest projects; `npm run test:unit` and `npm run test:integration` run one. See the root `AGENTS.md` for how the database is provided.

- **Integration tests go through the API** with the helpers in `test/support/api.ts` (`signUp`, `createTopic`, `createPost`, `edit`, `critique`, `interact`…), never through models directly, so routing, auth, SQL and git are exercised together.
- **Rate limits are off in tests** (`vitest.config.ts`), since helpers sign up many users from one address. `rateLimit.test.ts` turns them on with low values and acts as different clients through `X-Forwarded-For`.
- **Data is per file, not per test.** Tests in a file share a database, so make what each test needs (helpers generate unique names and titles) and don't assume a table is empty; a test that counts everything goes in its own file (e.g. `topics.test.ts`).
- **Unit tests import modules directly.** Mock `@/pgDatabase` (`vi.mock`) when a module under test imports it, or the pool will try to connect.
