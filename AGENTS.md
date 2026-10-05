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

## Running it

- **Everything:** copy `.env.example` to `.env` (needs `ACCESS_TOKEN_SECRET` of 32+ characters and `POSTGRES_PASSWORD`) and `docker compose up --build`.
- **Development:** `run.sh` starts `bun run dev -- --host` in `frontend/` (Vite, port 5173) and `bun --watch src/server.ts` in `backend/` (port 3000), which reads `backend/.env`. The frontend's API address comes from `VITE_API_ADDRESS` (`frontend/.env`). Postgres runs separately (the compose `db` service uses port 5434).
- **Builds:** `npm run build` in each package. The backend runs on Node 24 in Docker and also works on Node 25.

## Testing and verifying

There is no automated test suite yet. Changes so far were verified with throwaway setups, and that remains the expected bar: show it works, don't assume.

- **Database:** start a disposable cluster rather than touching the developer's: `/usr/lib/postgresql/16/bin/initdb -D <tmp>/pg -U postgres --auth=trust`, then `pg_ctl -o "-p 5499 -c listen_addresses=localhost" start`, then run the backend against it with its own `DB_PATH`. Add `-c log_statement=all` to count queries. The server's Postgres logs in Portuguese ("executar", not "execute").
- **Browser:** `puppeteer-core` against the installed `/usr/bin/google-chrome` (headless), installed into a temp directory, never into the project.
- **Frontend logic in isolation:** Bun with `jsdom` can import `frontend/src/assets/*.js` and the real TipTap schema, but needs a preload plugin that stubs `.scss` imports (the chart component imports SCSS modules).
- **Behaviour changes:** run the previous commit in a `git worktree` next to the new code against the same database and compare responses.
- **Lint:** `npm run lint` in `frontend/` reports hundreds of existing `react/prop-types` errors; compare against `HEAD` and only fix what you introduce.

## Working conventions

- UI text, API error messages and commit subjects are in **Portuguese**; code, comments and identifiers in **English**.
- Commit messages follow `type(scope): Subject` (`feat`, `fix`, `chore`, `refactor`, `style`; scope `frontend`/`backend` when it applies). The author usually commits; ask before committing and never push.
- There is no deployed instance or production data yet: breaking changes are fine and data migrations aren't needed. Edit `init.sql` directly. Re-check this once an instance exists.
- The developer often has the dev servers running (`bun --watch` on 3000, Vite on 5173); edits reload them. Don't kill processes you didn't start; find yours by port (`ss -ltnp`). Use separate ports (e.g. 3999, 5199, 5499) for your own servers and clean up after.
- Avoid `git stash` on the developer's working tree; to compare with an older commit, use `git show <rev>:<path>` or a temporary `git worktree`.
- Comments explain *why* (constraints, pitfalls, decisions), match the surrounding style, and stay short.

## Known issues and backlog

- **Merge conflicts:** git refuses to merge changes on adjacent lines (e.g. the author edited a paragraph and a suggestion added one right after it). Merging then fails with "Conflito no merge!" and there's no resolution UI yet.
- **Critique anchoring payload:** the version endpoint sends the text of every version between a critique's version and the one being read. Long histories will need the server-side `critique_anchors` cache planned for phase 3.
- **Global title uniqueness:** content titles are unique across the whole site, critiques included.
- **Frontend bugs:**
  - `PostSummary` uses an undeclared `index` (throws for posts without `config.answer`).
  - `Pagination` calls hooks conditionally.
  - `/write` crashes when opened directly (it needs the topic in router state).
- **Unfinished features:** tags, colcoins (the promote cost check is commented out) and prestige exist in the schema but aren't implemented. The README's to-do list is outdated.
- **Server defaults:** unknown API routes return Express's HTML 404, not JSON.
