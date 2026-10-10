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
| Content and history | git, one bare repo per topic under `DB_PATH`, written with plumbing commands | `backend/src/gitDatabase.ts` |
| Validation | JSON Schemas checked with Ajv 8, the same in the forms and the API | `shared/` |
| Serving | nginx serves the built frontend, proxies `/api/` to the backend and sends the security headers (CSP and others, `nginx/headers.conf`) | `nginx/`, `docker-compose.yml` |

### How data is split between git and Postgres

- **Postgres** holds users, the `contents` rows (topics, posts, critiques), `interactions` (votes, bookmarks, suggestions…) and anything queried or counted.
- **git** holds the versioned text of topics and posts. Each topic is a repo whose `main` branch has the topic's text; each post is a branch named by its id; every edit is a commit. The file is always `main.html`, stored one block element per line so git can diff and merge it.
- A post's `body` in Postgres is only a 280-character summary (first non-empty paragraph); the full text is in git. Critique bodies are not versioned and live only in Postgres.
- **Search** reads only Postgres: `contents.search_text` is the plain text of a content's latest version (for posts, copied from git on every commit), `tag_names` its topic's visible tags, and the generated `search` tsvector weighs title, tags and text in that order. The `colcom` text search configuration is Portuguese with accents dropped (`unaccent`). `GET /search` finds topics and posts (never critiques); `/search` shows them with the matched passage.
- Postgres and git can't share a transaction: when the git write fails, the controller removes the row it just inserted (`withRollback`).

### Content model

| Type | Parent | `config` | Notes |
|---|---|---|---|
| topic | none | `{ answers: ["sim", "não", …] }` | A git repo; the poll's possible answers |
| post | a topic | `{ answer }` | A branch in the topic's repo; defends one answer |
| critique | a post | `{ commit, from, to, quote: { exact, prefix, suffix, start } }` | Anchored to the exact version it criticised; critiques of critiques are refused |

Interactions (`interactions.type`): `up`/`down` (relevance, mutually exclusive), `vote` (the poll: one per user per topic, on a post; the row holds only the current vote, and a trigger appends every cast, change and removal to `vote_events`, which rejects UPDATE, DELETE and TRUNCATE, served at `GET /topics/:id/votes`), `bookmark`, `promote` (a topic, valid until the end of the day), `suggestion` (an edit proposed by someone other than the author; `config: { commit, message, accepted }`).

Tags (`tags`, `tag_votes`, `contents_tags`, `tag_events`) go on topics only; posts and critiques belong to their topic's. A tag is identified by its slug (`tagSlug` in `shared/`: accents dropped, lowercase, words joined by "-"), and `/t/a+b` lists the topics having all of them, like a forum's section narrowed by each tag added. Who decides is everyone, through votes:

- **Curation:** the author's first tags (up to 5) are their endorsements. Anyone can endorse (+1) or contest (−1) a tag on any topic, or propose one by endorsing it (up to 10 per topic). A tag shows while it has at least as many endorsements as contests, so one contest can't remove it. A trigger on `tag_votes` logs every vote in `tag_events` (append-only, like `vote_events`, served at `GET /topics/:id/tags/history`) and keeps the counts in `contents_tags`.
- **Lifecycle:** using a tag is free, creating one is limited: not before an account is `TAG_MIN_ACCOUNT_DAYS` old (which also gates voting on other people's topics) and at most `TAG_CREATE_PER_DAY` a day. A new tag is provisional (a dashed pill) until it shows on `TAG_ACTIVATION_TOPICS` topics by two or more authors, and expires (hidden, no longer usable, never deleted) if that takes over `TAG_PROVISIONAL_DAYS`. The operator merges duplicates with `SELECT merge_tag('duplicate', 'target')`, which moves the votes and leaves an alias that links and filters follow.
- **Reserved:** a reserved tag (`tags.reserved`) is applied only by the instance: the API refuses to create a topic with it or to propose, endorse, contest or withdraw it (403), and the autocomplete leaves it out. The only one is "Meta", below.
- **Search:** `tagFilterSql` (`models/tags.ts`) is the one intersection filter, shared by the topic lists and search's `tags`. A tag's name is also searchable text: the `tag_votes` trigger copies a topic's visible tags to it and its posts (`refresh_tag_names`). `contents_tags.created_at` and `tag_events` hold what charts of tags over time and co-occurrence will need.

**Meta** (`/meta`) is where people decide how colcom itself should be and work. At every start the backend makes what's missing of it (`backend/src/meta.ts`): a system account `colcom` (it can't be logged into, and its name and email can't be signed up for), the reserved tag "Meta" and the foundational topics defined in `backend/src/metaTopics.ts`, in groups ("Carta do colcom": mission, vision and values; "Funcionamento": improvements, consensus, moderation, whether meta votes bind the maintainers, one person one vote), each authored by that account and tagged by its logged vote. A topic is found again by its title, so editing a definition's title opens a new topic. Until synthesis posts exist, a meta topic's most voted post stands as the community's position.

Notifications (`notifications` table) tell a user, on the site, about a critique, a suggestion or a clone of their post, a new post in their topic, and the answer to their suggestion. The bell in the navbar shows how many are unread.

Collaboration flow: a non-author editing a post creates a `suggestion` and a branch `<postId>_<interactionId>`; the author sees what it changes (highlighted against the version it branched from, `git merge-base`) and accepts (git merge into the post branch) or rejects it. git also refuses changes on adjacent lines, so when it does the texts are merged again line by line (`merge3` in `shared/src/merge.js`), which only refuses changes to the same lines. Those go to a resolution page (`/topics/:t/posts/:p/suggestions/:hash`): the author picks their version, the suggestion's or both for each conflict, reviews and may edit the result, and it's committed as the merge. Anyone can clone a post at any version into a new post (a branch from that commit).

Competition flow: a critique quotes a passage of a specific version. Later versions show it where that passage went (followed through every edit), mark it "changed" when the passage was edited, and list it under "removed" when the passage is gone. A commit can never make a critique disappear; in phase 2 only people will close critiques.

### Validation (`shared/`)

Every request's shape and size is described once, in `shared/` (the `@colcom/shared` package, plain ESM JavaScript with no dependencies), and checked with the same schemas by the forms and by the API. Both packages install it as `"file:../shared"`; Docker gets it through compose's `additional_contexts`.

- **Limits** (`shared/src/limits.js`): every size (title, username, password, answers, bodies, quote, page size…) is a value in `DEFAULT_LIMITS`, and every schema is built from them, so changing a limit there changes it everywhere. `createValidators(Ajv, { limits: { title: { max: 200 } } })` overrides some for one instance. `users.name` and `users.email` are also sized in `init.sql`: keep them in step.
- **Schemas** (`shared/src/schemas.js`): request bodies (`signUp`, `login`, `topic`, `post`, `critique`, `edit`, `resolution`, `clone`, `interaction`, `tagVote`) and, with type coercion, query strings and route parameters (`list`, `tagList`, `search`, `contentParams`, `versionParams`, `tagParams`). Unknown keys are removed and defaults filled in.
- **Messages** (`shared/src/errors.js`): each error has the field's `key` (its path, like `config.answers.1`), its `label` and a short Portuguese `message` for the form ("máximo de 150 caracteres"); `describe` makes the API's sentence ("Título: máximo de 150 caracteres."). Labels, per-keyword `messages` and an `action` hint are annotations inside the schemas.
- **Custom rules:** `trimmed`, `notBlank` and `maxBytes` (UTF-8 bytes, because bcrypt reads only the first 72 bytes of a password); formats `email`, `commit`, `uuid` and `png` (base64). A username can't contain "@", since logging in tells names from emails by it. A tag name is Latin letters (accented ones included), digits and single spaces or hyphens (`TAG_NAME_PATTERN`), so its slug has its exact length and the name's limits are the slug's.
- **Compiling:** the backend compiles the schemas at runtime (`createValidators(Ajv)`). The frontend can't, as the CSP has no `'unsafe-eval'`: its Vite plugin (`frontend/plugins/validators.js`) turns them into Ajv standalone code at build time (`@colcom/shared/standalone`) and wraps it with `createPrecompiledValidators`. So custom keywords are `code` generators, not `validate` functions, and function formats are imported by the generated code from the package; `frontend/test/plugins/validators.test.js` checks both agree.
- **Merging** (`shared/src/merge.js`, not validation but shared the same way): `merge3(base, ours, theirs)` splits documents into lines (blocks), diffs each side against the base (Myers, compared as one block past 1000 changed lines) and returns `ok` chunks and `conflict` chunks where both sides changed the same lines differently. The backend commits a merge without conflicts (`cleanMerge`); the resolution page shows the conflicts.
- **What schemas can't check** stays in the backend: a critique's commit must be in the post's history, a post's answer must be one of its topic's, names and emails must be unused.
- `shared/index.d.ts` (and `standalone.d.ts`) type the package; keep them in step with `src/`.

## Running it

- **Everything:** copy `.env.example` to `.env` (needs `ACCESS_TOKEN_SECRET` of 32+ characters and `POSTGRES_PASSWORD`) and `docker compose up --build`. The frontend is built against the relative `/api`, so it works from any host; `VITE_API_ADDRESS` in `.env` overrides it (an address on another origin must also be added to the CSP's `connect-src`). Optional settings (`CORS_ORIGIN`, `TRUST_PROXY`, the `RATE_LIMIT_*` limits, the `TAG_*` limits on creating tags) are explained there too. `DOMAIN` (with `LETSENCRYPT_EMAIL`) turns on HTTPS: the `certbot` service gets the certificate and checks twice a day whether it needs renewing, and nginx's `nginx/40-select-config.sh` (run by the image's entrypoint) renders `nginx-https.conf` once the certificate exists, serving `nginx-http.conf` (which answers the ACME challenge) until then, and reloads when it changes. Without `DOMAIN` nginx serves plain HTTP and certbot exits.
- **Development:** `run.sh` starts `bun run dev -- --host` in `frontend/` (Vite, port 5173) and `bun --watch src/server.ts` in `backend/` (port 3000), which reads `backend/.env`. The frontend's API address comes from `VITE_API_ADDRESS` (`frontend/.env`), and is `http://localhost:3000` in dev and `/api` in a build when unset. Postgres runs separately (the compose `db` service uses port 5434).
- **Mock data:** with the backend running, `npm run seed` in `backend/` fills an empty instance through the API (`scripts/seed.mjs`; `API=http://host:port` targets another one; it signs up more users than the default sign-up limit allows and gives brand new users tags to create, so run the backend with `RATE_LIMIT_SIGN_UP=off TAG_MIN_ACCOUNT_DAYS=0`): 8 users with the password `colcom123`, four topics (one open), posts with edits, headings, lists and charts, suggestions in every state (merged by git, by `merge3`, with a resolution, rejected and pending) and clones, critiques (some on charts or on passages later changed or removed), votes changed and withdrawn, posts in two meta topics, notifications read and unread, and tags (one active, the rest provisional, contested, hidden or withdrawn). The four-day week post (log in as `elisa_prado`) has a chart critiqued and then altered, and two pending suggestions that conflict with its latest commit, to try the resolution page.
- **Backups:** `docker compose -f docker-compose.yml -f backup-service.yml run --rm backup` dumps Postgres and archives the git repos into `./backups`; restoring, scheduling and the consistency check (`npm run check:consistency` in `backend/`) are in `backend/scripts/backup/README.md`.
- **Builds:** `npm run build` in each package. The backend runs on Node 24 in Docker and also works on Node 25, and needs git 2.38 or newer (for `merge-tree --write-tree`; it refuses to start otherwise). Ubuntu 22.04 ships 2.34: use the `ppa:git-core/ppa`. Postgres needs the `unaccent` extension (contrib), which the official image and Debian's and Ubuntu's server packages include; `init.sql` creates it, so the database user must be allowed to.

## Testing and verifying

Both packages have a Vitest suite; run `npm test` in `backend/` and in `frontend/` (also `npm run test:watch` and `npm run coverage`). GitHub Actions runs both on every push (`.github/workflows/tests.yml`). Add or update tests with every change, and keep them green: a bug the suite can't catch yet deserves a test.

- **Backend** (`backend/test/`): `unit/` tests pure modules; `integration/` drives the real app through HTTP (supertest) against a real Postgres and real git repos. Its global setup starts a throwaway Postgres cluster from the local binaries (`initdb`, found on `PATH`, in `PG_BIN` or under `/usr/lib/postgresql`), or uses a running server when `TEST_POSTGRES_HOST` is set (as CI does). Each test file gets its own database, cloned from a template with the schema, and its own `DB_PATH`, so files run in parallel and see none of each other's data. Tests isolate git from the developer's config (`GIT_CONFIG_GLOBAL=/dev/null`).
- **Frontend** (`frontend/test/`): jsdom + Testing Library. `assets/` covers anchoring, diffing and density; `editor/` runs the real TipTap extensions; `components/` and `pages/` render components with `fetch` stubbed (`vi.stubGlobal`). `test/support/critiques.js` makes critiques the way the post page does, from a selected text.
- **Known bugs** are recorded as `it.fails` tests with a comment; when one is fixed its test starts failing, and `.fails` must be dropped.
- **Load tests** (`backend/scripts/loadtest/`, outside the suite): `npm run loadtest:bench` in `backend/` runs any revision against a throwaway Postgres under concurrent load, then checks that no write was lost. Run it before and after changes to the git layer or the request path; see `backend/AGENTS.md`.

Beyond the suite, show changes work rather than assume they do:

- **Database:** start a disposable cluster rather than touching the developer's: `/usr/lib/postgresql/16/bin/initdb -D <tmp>/pg -U postgres --auth=trust`, then `pg_ctl -o "-p 5499 -c listen_addresses=localhost" start`, then run the backend against it with its own `DB_PATH`. Add `-c log_statement=all` to count queries. The server's Postgres logs in Portuguese ("executar", not "execute").
- **Browser:** `puppeteer-core` against the installed `/usr/bin/google-chrome` (headless), installed into a temp directory, never into the project.
- **Behaviour changes:** run the previous commit in a `git worktree` next to the new code against the same database and compare responses.
- **Lint:** `npm run lint` in `frontend/` is clean (no errors or warnings); keep it that way.

## Working conventions

- UI text and API error messages are in **Portuguese**; code, comments, identifiers and commit messages in **English**.
- Commit messages follow `type(scope): Subject` (`feat`, `fix`, `chore`, `refactor`, `style`; scope `frontend`/`backend` when it applies), with the subject in the third person present, capitalized and without a final period, as in `git log`: "fix(frontend): Restores title editing in Firefox prior to version 136", "chore: Adds AGENTS.md and CLAUDE.md files".
- Work on a branch off `main` (named like `ui/post-vote-share`) in your own `git worktree`, and commit there without asking when a change is done. Don't commit in the developer's checkout or on `main`, and never push or merge: the author reviews the branch and merges it into `main` ("chore: Merges ui/post-vote-share").
- There is no deployed instance or production data yet: breaking changes are fine and data migrations aren't needed. Edit `init.sql` directly. Re-check this once an instance exists.
- The developer often has the dev servers running (`bun --watch` on 3000, Vite on 5173); edits reload them. Don't kill processes you didn't start; find yours by port (`ss -ltnp`). Use separate ports (e.g. 3999, 5199, 5499) for your own servers and clean up after.
- Avoid `git stash` on the developer's working tree; to compare with an older commit, use `git show <rev>:<path>`, or a temporary `git worktree`.
- Comments explain *why* (constraints, pitfalls, decisions), match the surrounding style, and stay short.

## Known issues and backlog

- **Critique anchoring payload:** the version endpoint sends the text of every version between a critique's version and the one being read. Long histories will need the server-side `critique_anchors` cache planned for phase 3.
- **Global title uniqueness:** content titles are unique across the whole site, critiques included.
- **Frontend bug:** `relativeTime` doesn't round years ("1.04… ano").
- **Unfinished features:** colcoins (the promote cost check is commented out) and prestige exist in the schema but aren't implemented.
