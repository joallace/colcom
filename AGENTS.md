# colcom

**colcom** ("colaboração e competição") is a forum where every topic is a git repository. Users collaborate through git operations (suggestions are branches, accepting one is a merge, forking a post is a branch) and compete by criticising passages of each other's posts and voting in each topic's poll. The goal is dialectics at scale: thesis, antithesis and synthesis, with the strongest ideas from every side surviving critique and convincing across sides.

It started as the author's TCC (bachelor's thesis). The long-term ambition is a free, open-source, self-hostable digital-democracy tool usable by governments, alongside projects like Brasil Participativo, Pol.is, vTaiwan, Decidim and Consul. Weigh decisions against that: auditability (git history is a tamper-evident record), explainable rules, and staying simple to self-host with one `docker compose up`.

The design for what comes next (critique lifecycle, synthesis posts, bridging-based ranking) is in a Claude Doc: https://claude.ai/code/artifact/c26afe60-54e0-4ef5-901e-7d42ce8d6dbe. Read its "Open questions" section; the author answered them inline. Phase 1 (critiques follow the text across versions) is done; phase 2 (critique states, author/critic actions) is next.

More specific guides: [`backend/AGENTS.md`](backend/AGENTS.md) and [`frontend/AGENTS.md`](frontend/AGENTS.md).

## Architecture

| Part | Stack | Where |
|---|---|---|
| Frontend | React 19, React Router 7, TipTap 3 (ProseMirror), Floating UI, Recharts 3, Vite 8, SCSS | `frontend/` |
| Backend | Express 5, TypeScript 7 (built with `tsc` + `tsc-alias`), `pg`, pino | `backend/` |
| Relational data | PostgreSQL 18 (Docker); schema in `backend/src/sql/init.sql`, applied on every start | — |
| Content and history | git, one repo per topic under `DB_PATH` | `backend/src/gitDatabase.ts` |
| Validation | JSON Schemas checked with Ajv 8, the same in the forms and the API | `shared/` |
| Serving | nginx serves the built frontend and proxies `/api/` to the backend | `nginx/`, `docker-compose.yml` |

### How data is split between git and Postgres

- **Postgres** holds users, the `contents` rows (topics, posts, critiques), `interactions` (votes, bookmarks, suggestions…) and anything queried or counted.
- **git** holds the versioned text of topics and posts. Each topic is a repo whose `main` branch has the topic's text; each post is a branch named by its id; every edit is a commit. The file is always `main.html`, stored one block element per line so git can diff and merge it.
- A post's `body` in Postgres is only a 280-character summary (first non-empty paragraph); the full text is in git. Critique bodies are not versioned and live only in Postgres.
- Postgres and git can't share a transaction: when the git write fails, the controller removes the row it just inserted (`withRollback`).

### Content model

| Type | Parent | `config` | Notes |
|---|---|---|---|
| topic | none | `{ answers: ["sim", "não", …] }` | A git repo; the poll's possible answers |
| post | a topic | `{ answer }` | A branch in the topic's repo; defends one answer |
| critique | a post | `{ commit, from, to, quote: { exact, prefix, suffix, start } }` | Anchored to the exact version it criticised; critiques of critiques are refused |

Interactions (`interactions.type`): `up`/`down` (relevance, mutually exclusive), `vote` (the poll: one per user per topic, on a post), `bookmark`, `promote` (a topic, valid until the end of the day), `suggestion` (an edit proposed by someone other than the author; `config: { commit, message, accepted }`).

Collaboration flow: a non-author editing a post creates a `suggestion` and a branch `<postId>_<interactionId>`; the author sees what it changes (highlighted against the version it branched from, `git merge-base`) and accepts (git merge into the post branch) or rejects it. Anyone can clone a post at any version into a new post (a branch from that commit).

Competition flow: a critique quotes a passage of a specific version. Later versions show it where that passage went (followed through every edit), mark it "changed" when the passage was edited, and list it under "removed" when the passage is gone. A commit can never make a critique disappear; in phase 2 only people will close critiques.

### Validation (`shared/`)

Every request's shape and size is described once, in `shared/` (the `@colcom/shared` package, plain ESM JavaScript with no dependencies), and checked with the same schemas by the forms and by the API. Both packages install it as `"file:../shared"`; Docker gets it through compose's `additional_contexts`.

- **Limits** (`shared/src/limits.js`): every size (title, username, password, answers, bodies, quote, page size…) is a value in `DEFAULT_LIMITS`, and every schema is built from them, so changing a limit there changes it everywhere. `createValidators(Ajv, { limits: { title: { max: 200 } } })` overrides some for one instance. `users.name` and `users.email` are also sized in `init.sql`: keep them in step.
- **Schemas** (`shared/src/schemas.js`): request bodies (`signUp`, `login`, `topic`, `post`, `critique`, `edit`, `clone`, `interaction`) and, with type coercion, query strings and route parameters (`list`, `contentParams`, `versionParams`). Unknown keys are removed and defaults filled in.
- **Messages** (`shared/src/errors.js`): each error has the field's `key` (its path, like `config.answers.1`), its `label` and a short Portuguese `message` for the form ("máximo de 150 caracteres"); `describe` makes the API's sentence ("Título: máximo de 150 caracteres."). Labels, per-keyword `messages` and an `action` hint are annotations inside the schemas.
- **Custom rules:** `trimmed`, `notBlank` and `maxBytes` (UTF-8 bytes, because bcrypt reads only the first 72 bytes of a password); formats `email`, `commit`, `uuid` and `png` (base64). A username can't contain "@", since logging in tells names from emails by it.
- **What schemas can't check** stays in the backend: a critique's commit must be in the post's history, a post's answer must be one of its topic's, names and emails must be unused.
- `shared/index.d.ts` types the package for the backend; keep it in step with `limits.js` and `schemas.js`.

## Running it

- **Everything:** copy `.env.example` to `.env` (needs `ACCESS_TOKEN_SECRET` of 32+ characters and `POSTGRES_PASSWORD`) and `docker compose up --build`. Optional settings (`CORS_ORIGIN`, `TRUST_PROXY`, the `RATE_LIMIT_*` limits) are explained there too.
- **Development:** `run.sh` starts `bun run dev -- --host` in `frontend/` (Vite, port 5173) and `bun --watch src/server.ts` in `backend/` (port 3000), which reads `backend/.env`. The frontend's API address comes from `VITE_API_ADDRESS` (`frontend/.env`). Postgres runs separately (the compose `db` service uses port 5434).
- **Mock data:** with the backend running, `npm run seed` in `backend/` fills an empty instance through the API (`scripts/seed.mjs`; `API=http://host:port` targets another one; it signs up more users than the default sign-up limit allows, so run the backend with `RATE_LIMIT_SIGN_UP=off`): 8 users with the password `colcom123`, three topics (one open), posts with edits, suggestions (one pending) and a clone, critiques (some on passages later changed or removed) and votes.
- **Builds:** `npm run build` in each package. The backend runs on Node 24 in Docker and also works on Node 25.

## Testing and verifying

Both packages have a Vitest suite; run `npm test` in `backend/` and in `frontend/` (also `npm run test:watch` and `npm run coverage`). GitHub Actions runs both on every push (`.github/workflows/tests.yml`). Add or update tests with every change, and keep them green: a bug the suite can't catch yet deserves a test.

- **Backend** (`backend/test/`): `unit/` tests pure modules; `integration/` drives the real app through HTTP (supertest) against a real Postgres and real git repos. Its global setup starts a throwaway Postgres cluster from the local binaries (`initdb`, found on `PATH`, in `PG_BIN` or under `/usr/lib/postgresql`), or uses a running server when `TEST_POSTGRES_HOST` is set (as CI does). Each test file gets its own database, cloned from a template with the schema, and its own `DB_PATH`, so files run in parallel and see none of each other's data. Tests isolate git from the developer's config (`GIT_CONFIG_GLOBAL=/dev/null`).
- **Frontend** (`frontend/test/`): jsdom + Testing Library. `assets/` covers anchoring, diffing and density; `editor/` runs the real TipTap extensions; `components/` and `pages/` render components with `fetch` stubbed (`vi.stubGlobal`). `test/support/critiques.js` makes critiques the way the post page does, from a selected text.
- **Known bugs** are recorded as `it.fails` tests with a comment; when one is fixed its test starts failing, and `.fails` must be dropped.

Beyond the suite, show changes work rather than assume they do:

- **Database:** start a disposable cluster rather than touching the developer's: `/usr/lib/postgresql/16/bin/initdb -D <tmp>/pg -U postgres --auth=trust`, then `pg_ctl -o "-p 5499 -c listen_addresses=localhost" start`, then run the backend against it with its own `DB_PATH`. Add `-c log_statement=all` to count queries. The server's Postgres logs in Portuguese ("executar", not "execute").
- **Browser:** `puppeteer-core` against the installed `/usr/bin/google-chrome` (headless), installed into a temp directory, never into the project.
- **Behaviour changes:** run the previous commit in a `git worktree` next to the new code against the same database and compare responses.
- **Lint:** `npm run lint` in `frontend/` is clean (no errors or warnings); keep it that way.

## Working conventions

- UI text and API error messages are in **Portuguese**; code, comments, identifiers and commit messages in **English**.
- Commit messages follow `type(scope): Subject` (`feat`, `fix`, `chore`, `refactor`, `style`; scope `frontend`/`backend` when it applies), with the subject in the third person present, capitalized and without a final period, as in `git log`: "fix(frontend): Restores title editing in Firefox prior to version 136", "chore: Adds AGENTS.md and CLAUDE.md files". The author usually commits: when a change is done, suggest its message; ask before committing and never push.
- There is no deployed instance or production data yet: breaking changes are fine and data migrations aren't needed. Edit `init.sql` directly. Re-check this once an instance exists.
- The developer often has the dev servers running (`bun --watch` on 3000, Vite on 5173); edits reload them. Don't kill processes you didn't start; find yours by port (`ss -ltnp`). Use separate ports (e.g. 3999, 5199, 5499) for your own servers and clean up after.
- Avoid `git stash` on the developer's working tree; to compare with an older commit, use `git show <rev>:<path>`, or a temporary `git worktree`.
- Comments explain *why* (constraints, pitfalls, decisions), match the surrounding style, and stay short.

## Known issues and backlog

- **Merge conflicts:** git refuses to merge changes on adjacent lines (e.g. the author edited a paragraph and a suggestion added one right after it). Merging then fails with "Conflito no merge!" and there's no resolution UI yet.
- **Critique anchoring payload:** the version endpoint sends the text of every version between a critique's version and the one being read. Long histories will need the server-side `critique_anchors` cache planned for phase 3.
- **Global title uniqueness:** content titles are unique across the whole site, critiques included.
- **Frontend bugs:**
  - `/write` crashes when opened directly (it needs the topic in router state).
  - `relativeTime` doesn't round years ("1.04… ano").
- **Backend bugs:**
  - `GET /contents/:id/interactions` is unreachable: `GET /contents/:id/:hash` is registered first and takes "interactions" as a hash. `GET /users/:id/interactions` passes a user id as a content id. Nothing calls either yet.
  - An `up`, `down` or `bookmark` on a content that doesn't exist is a 500 (foreign key violation), not a 404.
- **Unfinished features:** tags, colcoins (the promote cost check is commented out) and prestige exist in the schema but aren't implemented. The README's to-do list is outdated.
