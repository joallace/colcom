# colcom backend

Express 5 + TypeScript 7 API over PostgreSQL and per-topic git repositories. Read the root [`AGENTS.md`](../AGENTS.md) first for what colcom is and how data is split between git and Postgres.

## Layout

| Path | What it holds |
|---|---|
| `src/app.ts` | App setup: CORS, JSON body parser, routers, error handler |
| `src/server.ts` | Starts listening; kept apart so tests import the app without binding a port |
| `src/routes/*.ts` | Route → middleware → controller wiring |
| `src/controllers/*.ts` | Request handling, validation, orchestration of models and git |
| `src/models/*.ts` | All SQL. `content.ts` has `findAll`, `findTree`, `summarize`; `interactions.ts` has votes, bookmarks and suggestions |
| `src/gitDatabase.ts` | Every git command (the only place that runs git) |
| `src/pgDatabase.ts` | Connection pool; runs `sql/init.sql` on first connect (exits if it fails) |
| `src/config.ts` | Required settings; the server refuses to start without `ACCESS_TOKEN_SECRET` (32+ chars) |
| `src/validation.ts` | `validate(schema, data)`: checks a request's body, query or params against the shared schemas (`shared/`) and returns the validated copy |
| `src/pagination.ts` | `orderByColumn` whitelist and `limitOffset` clamping |
| `src/errors.ts` | Error classes; messages and `action` hints in Portuguese |

Imports use the `@/` alias (`tsconfig` paths, rewritten by `tsc-alias` at build). `npm run build` also copies `sql/` into `build/`.

## The git layer (`gitDatabase.ts`)

- **Layout:** one repo per topic at `DB_PATH/<topicId>`. Branch `main` holds the topic; each post is a branch named by its id; suggestions are branches `<postId>_<interactionId>`. The single file is `main.html`.
- **One block per line:** `formatHtml` puts each block element (paragraph, heading, list item…) on its own line before committing. The editor emits a whole document as one line, and without this any two edits conflict. The browser's parser ignores this whitespace, so documents and critique positions are unaffected; code blocks are left untouched.
- **Serialized writes:** every write runs through `write()`, which holds a module-wide `AsyncLock` per repo (writes share the repo's working tree and check out branches) and runs `git reset --hard` if the operation fails, so a failed write can't block the repo.
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
- **Unique indexes:** they prevent duplicate up/down votes, bookmarks and poll votes; a racing duplicate insert becomes a 409.

## Security rules

- **Auth:** `authHandler()` (required) or `authHandler(true)` (optional) verifies the JWT and puts the user in `res.locals.user` (`{ username, email, pid }`). Never read the user from `req.params`.
- **Ownership:** only a post's author merges or rejects its suggestions (`findOwnedSuggestion` checks the post, the author and that the hash is a *pending* suggestion of that post). State-changing routes use POST/PATCH, never GET.
- **Errors:** throw the classes from `errors.ts`. `errorHandler` returns only `BaseError`s (without stack); anything else (e.g. a pg error with table names) becomes a generic 500 with an `errorId`, and the full error is logged.
- **Validate every input.** Controllers pass `req.body`, `req.query` and `req.params` through `validate` (`src/validation.ts`) before using them, and use what it returns: Express 5 parses `req.query` again on each access, so changes to it are lost. A failure is a 400 `ValidationError` whose `message` and `key` name the first problem and whose `errors` list all of them (`{ key, label, message }`), which the forms show by field.
- **Critique anchors:** the `critique` schema checks the shape and strips unknown keys; `validateCritiqueCommit` requires the commit to be in the post's own history.

## API

| Method and path | Auth | Purpose |
|---|---|---|
| `POST /users`, `POST /login` | — | Sign up; log in (returns `accessToken`) |
| `GET /users/self` | required | Current user, with the topic they're promoting |
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
| `POST /interactions` | required | Toggle `up`/`down`/`vote`/`bookmark`/`promote` |

`lineages` maps each earlier version that critiques were made on to the list of commits from it to the requested one, along the post's first-parent history. `versions` holds the text of every commit in those lists. The frontend follows each critiqued passage through those edits (see `frontend/AGENTS.md`).

Lists that include topics (`toFeed`) return topics with their posts, posts with `topic: { id, title }`, and critiques with `post: { id, title }` and `topic: { id }`.

## Tests

`npm test` runs both Vitest projects; `npm run test:unit` and `npm run test:integration` run one. See the root `AGENTS.md` for how the database is provided.

- **Integration tests go through the API** with the helpers in `test/support/api.ts` (`signUp`, `createTopic`, `createPost`, `edit`, `critique`, `interact`…), never through models directly, so routing, auth, SQL and git are exercised together.
- **Data is per file, not per test.** Tests in a file share a database, so make what each test needs (helpers generate unique names and titles) and don't assume a table is empty; a test that counts everything goes in its own file (e.g. `topics.test.ts`).
- **Unit tests import modules directly.** Mock `@/pgDatabase` (`vi.mock`) when a module under test imports it, or the pool will try to connect.
