# colcom backlog

Last reviewed: 2026-10-07. Gathered from `AGENTS.md` (known issues), `README.md` (to-do list), the critique lifecycle and synthesis design doc (rollout phases 2–6 and its open questions), the thesis fragments in `docs/` (future work, chapters 4 and 5), and a read of the code. Items marked *(new)* are ones none of those sources list.

## Scoring

Every task has a **criticality score from 1 to 10**. The list is sorted by it.

| Score | Meaning |
|---|---|
| 9–10 | A real instance would be unsafe without it: security, data loss, vote integrity |
| 7–8 | Breaks a core flow, blocks self-hosting, or is the next step of the core design |
| 5–6 | Important for adoption, trust or correctness, with a workaround today |
| 3–4 | Planned features and minor bugs |
| 1–2 | Nice to have, or worth reconsidering |

The score measures harm if the task is left undone, not the order to work in. The next pilot is meant to be as large and open as possible, so the anti-abuse items count as pilot blockers next to phase 2 of the design.

Since the code is open, anti-abuse measures must not depend on bots not knowing the rules. They should rely on cost (work, a verified email), time (account age), reputation, and detection after the fact.

---

## 9–10: required before any public instance

- [x] **[9] Rate limiting** *(new)*: `POST /login`, `POST /users`, `POST /contents` and `POST /interactions` have no limits. That allows password brute force, mass sign-ups and spam. Add per-IP and per-user limits (e.g. `express-rate-limit`, or `limit_req` in nginx). The design doc also asks for a critique rate limit per user per post.
    - Done with `express-rate-limit`: failed logins and sign-ups per IP, content writes and interactions per user, all `RATE_LIMIT_*` settings. **Left:** the per-user-per-post critique limit (critiques share the content-writes limit for now), and a shared store (counts are in memory, per process, reset on restart).
- [ ] **[9] Fake accounts and vote integrity** (thesis ch. 4 and 5, design doc "Incentives and anti-abuse"): one person can make many accounts and swing polls and reviews. Use layers, each one an instance setting:
    1. **Make accounts cost something:** email verification with a disposable-domain blocklist, plus a self-hosted proof-of-work challenge at sign-up (e.g. [ALTCHA](https://altcha.org), MIT licensed, no third party). Proof-of-work still holds when the code is public.
    2. **Probation:** a new account can write, but its poll votes, verdicts and up/down votes count only after N days and some activity (e.g. 7 days and one critique, suggestion or post). They are stored from the start and counted once probation ends. The topic page says how many votes are still in probation.
    3. **Allowed email domains** (instance setting, not for the first pilot): an instance run by an institution (a city hall, a council) can require its domain. That gives one email per person, already verified by the institution, at no cost.
    4. **Detection:** flag accounts created in bursts, from the same IP range, that vote the same way on the same posts. Flags go to review (see community moderation) and never discount votes automatically. Publish how many votes were discounted and why, to keep it auditable.
- [ ] **[9] Sign-up protection for the pilot**: the pilot will be open, on disputed topics, with no institution behind it, so it can't lean on an email domain. Until the layers above exist, open it through **invite chains**: each user gets a few invites, and the invite tree is recorded. A ring of fake accounts then traces back to the account that invited it, whose remaining invites can be frozen. Lift invites once proof-of-work, email verification and probation are in.
- [x] **[9] Backups and Postgres↔git consistency** *(new)*: `postgres_data` and `git_data` are Docker volumes with no backup or documented restore. Git is the tamper-evident record, so losing it loses the audit trail. Add a backup script or compose service, a restore guide, and a check that every topic/post row has its repo or branch (and the reverse). Since there is no shared transaction, `withRollback` can still leave strays when the process dies between the two writes.
    - Done: `backend/scripts/backup/` (backup and restore scripts, guide in its `README.md`), a `backup` service in `backup-service.yml`, and `npm run check:consistency` in `backend/` (both directions, `--fsck`, `--json`, `--set-aside` moves stray branches under `refs/orphaned/`). **Left:** scheduling is a cron line in the guide, not a service; off-site copies are up to the operator; rows without git data are only reported.

## 7–8: core flows, self-hosting, next phase

- [ ] **[8] Design phase 2: critique lifecycle** (design doc; next per `AGENTS.md`). Add a `critique_events` append-only log, states in `contents.status`, address/rebut (author) and accept/dispute/withdraw (critic) actions with server-side checks of actor and state, state badges on the post, and attaching a suggested fix to a critique (merging it resolves the critique). Also track the metrics the doc lists from phase 2 on.
- [x] **[8] Deployable frontend build** *(new)*: `docker-compose.yml` builds the frontend with `VITE_API_ADDRESS: http://localhost/api`, so any instance not opened from the server itself can't reach the API. Default to the relative `/api` (nginx already proxies it), or read it from `.env`.
- [x] **[8] HTTPS by default** *(new)*: HTTPS needs a commented-out volume swapped by hand, and `certificate-service.yml` still has `{email}`/`{domain}` placeholders and no renewal. Make the domain and email `.env` settings and renew certificates automatically.
    - Done: `DOMAIN` (and optional `LETSENCRYPT_EMAIL`, `LETSENCRYPT_STAGING`) in `.env`; a `certbot` service gets and renews the certificate; `nginx/40-select-config.sh` switches nginx to HTTPS once it exists and reloads on renewal. **Left:** never tested against Let's Encrypt with a real domain.
- [x] **[8] Lock down CORS and add security headers** *(new)*: `app.use(cors())` accepts any origin. Allow only the instance's own origin. In nginx, add CSP, `X-Content-Type-Options`, `Referrer-Policy` and HSTS (HTTPS only). The JWT sits in `localStorage`, so a CSP is the main backstop if user HTML ever slips past DOMPurify.
- [ ] **[8] Reports and community moderation** (thesis ch. 5: spam, trolling): no appointed moderators. Instead:
    1. The instance publishes a short code of conduct, and a report must name the rule it breaks ("spam", "ataque pessoal", "conteúdo ilegal"…). A report is not a downvote: disagreeing is never a reason to report.
    2. When reports from distinct, out-of-probation users pass a threshold, the content is **collapsed, not deleted**, behind "ocultado após denúncias — ver mesmo assim", pending a verdict.
    3. A **jury** of 5–7 users drawn at random from eligible ones (account age, prestige, not the author or reporters, from more than one answer group when possible) votes "breaks rule X" or "doesn't". Its verdict is public and written to the append-only log. One appeal goes to a bigger jury.
    4. Reporters whose reports keep failing lose prestige, and their reports count for less, so mass reporting fails.
    This reuses the design doc's public-verdict machinery (phase 3), so build them together. Thresholds go in the configurable profiles.
- [ ] **[8] Instance operator role and legal takedowns** *(new)*: community moderation can't handle content that must come down fast by law (Marco Civil da Internet arts. 19 and 21: court orders and non-consensual intimate images; also personal data under LGPD). Each instance needs an operator who can take content down, with every action in a public log ("removido por ordem judicial nº…"). Git keeps every version, so a takedown must also remove the text from history: rewrite the post's branch and record the removed blob's hash in the log, so the history stays verifiable.
- [x] **[7] Notifications** (needed by design phase 2): authors and critics have to learn that a critique, answer, dispute or suggestion is waiting, or the lifecycle stalls. Start with in-app notifications; email can come later.
    - Done in-app: critiques, suggestions, clones of your posts, new posts in your topics, and answers to your suggestions, with a bell and unread count in the navbar (polled every minute) and a `/notifications` page. **Left:** phase 2's events (an author's answer to a critique, a critic's dispute) once they exist, email, per-user preferences (which events, a digest), and following topics you didn't write.
- [ ] **[7] Merge conflicts** (`AGENTS.md` known issue): git refuses to merge edits on adjacent lines and the author only sees "Conflito no merge!". Either add a resolution UI (pick theirs/mine per block, since the file is one block per line) or rebase the suggestion onto the post's head when it can be done cleanly.
- [ ] **[7] Account management and LGPD** *(new)*: there is no password reset, no changing name/email/password, no account deletion and no data export. A civic tool in Brazil has to meet LGPD rights. Decide what deletion means for git history: anonymise the author in Postgres and keep the commits, or rewrite them. Also add a privacy policy page.
- [x] **[7] Session revocation** *(new)*: tokens last 7 days and can't be revoked. Logging out only clears `localStorage`, and a leaked token stays valid. Add a token version per user, or short-lived access tokens with a refresh token in an `httpOnly` cookie.
    - Done with a per-user `token_version` (the `ver` claim) checked on every authenticated request; `POST /logout` revokes every session of the user. **Left:** short-lived access tokens with a refresh cookie, and per-device sessions (logout ends all of them).
- [ ] **[7] Design phase 3: public verdicts**: `holds`/`not_holds` votes (only from people who voted in the topic), a scheduler for the 7-day review timer, verdicts, public reopen (20 votes, 75%), and the server-side `critique_anchors` cache. The cache also fixes the "critique anchoring payload" issue in `AGENTS.md`.
- [ ] **[7] Consent for public votes** *(new)*: poll votes are public (see Decisions), but a political opinion is sensitive personal data under LGPD (art. 5, II), and publishing it needs specific, explicit consent (art. 11). Sign-up must ask for it in plain words ("seus votos nas enquetes são públicos"), the topic page must say who voted for what, and an account deletion must also remove its votes from public view. Public votes also let someone prove how they voted, which makes vote buying easier. Government instances may want a secret-ballot setting later.

## 5–6: adoption, trust and correctness

- [ ] **[6] Configurable thresholds** (design doc open question, answered): move 7/14 days, 10 votes/60% and 20 votes/75% into configuration (`config.json` or a table), with default profiles by expected community size (small group, city, national).
- [x] **[6] `/write` crashes when opened directly** (`AGENTS.md`): it reads the topic from router state (`state.config`). Load the topic from a `?topic=` parameter instead. *(new)* The draft is saved under one global `editorContent` key, so a draft for one topic shows up when writing in another. Key it by topic.
- [x] **[6] Append-only poll vote history** *(new)*: changing a poll vote overwrites the `vote` row's `content_id`, and removing a vote deletes the row, so no history is kept. Log every change (from, to, when). The synthesis column's convergence numbers need it, and it lets anyone audit how a poll moved.
- [ ] **[6] Design phase 4: bridging ranking**: groups from poll votes, the score with its critique penalty, and a "Consenso" ordering next to the raw poll. Explain the formula in the UI, since explainable rules are a goal.
- [ ] **[5] Rewrite the README** (`README.md`): what colcom is, screenshots, a self-hosting guide (`.env`, HTTPS, backups), a development guide, and the comparison with Pol.is/Decidim/Consul/Wikilegis from thesis ch. 4. Replace its outdated to-do list with a link to this file.
- [ ] **[5] Accessibility audit** *(new)*: Brazilian government sites must follow eMAG/WCAG 2.1 AA. Check keyboard use of the editor, critique popovers and the version slider, screen reader labels, and the zoom layout. The contrast tokens are a good start.
- [x] **[5] Drop `'unsafe-eval'` from the CSP** *(new)*: the frontend's Ajv compiles the shared schemas with `new Function`, so `nginx/headers.conf` allows eval. Precompile them at build time (Ajv standalone code, which needs the custom keywords and formats as importable code) and remove it.
    - Done: a Vite plugin precompiles the shared schemas as Ajv standalone code, and the CSP's `script-src` is `'self'`.
- [ ] **[5] Full-text search** (README, thesis ch. 5): Postgres only stores a 280-character summary of each post, so either index the full text from git in a `tsvector` column on every commit or search the summaries only. Use the `portuguese` text search configuration.
- [ ] **[5] Scoring system (prestige)** (README; the design doc fixes which actions earn or cost prestige): pick the amounts and compute them from `critique_events` so every point can be explained. `users.prestige` exists but is unused.
- [ ] **[5] Design phase 5: synthesis posts**: creating them through `commit-tree`, the `content_sources` table, the three-pane editor, quoting with provenance, inherited critiques and fairness marks. A public "misrepresents my view" mark with an optional reason, as answered in the design doc. Syntheses get their own poll column (see Decisions).
- [ ] **[5] Discussion on critiques** (design doc open question, undecided): critiques of critiques are refused today. Decide whether the event thread (author's answer, critic's reply) is enough, or whether a short comment thread under each critique helps share the author's load in big topics.
- [ ] **[5] Tolerance filter** *(new, from your idea)*: each user picks how much to see ("tudo", "padrão", "só o essencial"). Content under the threshold is collapsed with a reason ("oculto pelo seu filtro: 3 críticas mantidas"), never removed, and the reader can always open it. Filter on report verdicts, upheld critiques and the bridging score, **never on raw downvotes or one side's votes**. Otherwise each side's filter hides the other side, and the filter becomes the echo chamber colcom is meant to break (thesis ch. 1). Show the filter's rule in plain words next to it.
- [ ] **[5] Global title uniqueness** (`AGENTS.md`): titles are unique across the whole site, critiques included, so a critic gets "title taken" for a title used in another topic. Make them unique per parent, or not unique at all for critiques.

## 3–4: planned features and minor bugs

- [ ] **[4] Design phase 6: re-synthesis and lineage**: "source updated since", the resynthesize merge, and the lineage view on the timeline.
- [x] **[4] 404 instead of 500 for missing content** (`AGENTS.md`): `up`, `down` or `bookmark` on a content that doesn't exist fails on the foreign key and returns 500.
- [ ] **[4] Load tests** (README): measure topic list, post page and edit throughput. The per-repo write lock and running git per request are the likely limits. Do this before the bare-repo move so it has a baseline.
- [ ] **[4] Bare repositories** (design doc): writes check out branches in a shared working tree under a lock. Bare repos with `commit-tree`/`update-ref` remove the checkout and make phase 5 simpler.
- [ ] **[4] Leaderboard ("pódio")** (README, thesis ch. 5): `pages/Leaderboard.jsx` is routed but renders an empty page. Build it on prestige, or hide the route until then.
- [ ] **[4] Tags** (README, thesis ch. 5): the `tags` and `contents_tags` tables exist, but there is no API or UI.
- [ ] **[4] Pluggable identity verification** (gov.br, not soon): put verification behind a provider interface (email, allowed domain, OpenID Connect) so gov.br, which supports OIDC, is a configuration change later. Store only "verified by X at level Y" for each user, never the documents (LGPD).
- [ ] **[3] Avatar drawing as a human signal** *(new, from your idea)*: recording the strokes on the sign-up pixel grid (timing, hesitation, order) can be **one weak signal** that feeds detection, never a gate. Since the code is open, a bot can replay recorded human strokes. A gate would also lock out screen-reader and motor-impaired users (eMAG), so keep a "gerar avatar" alternative. Store only aggregate features, not the raw trace.
- [ ] **[3] Interactions endpoints** (`AGENTS.md`): `GET /contents/:id/interactions` is shadowed by `/contents/:id/:hash`, and `GET /users/:id/interactions` passes a user id as a content id. Nothing calls them: fix them (and drop the `it.fails` in `interactions.test.ts`) or remove them.
- [x] **[3] JSON 404 for unknown API routes** (`AGENTS.md`): unknown routes return Express's HTML page.
- [ ] **[3] Colcoins and promote** (`AGENTS.md`): the promote cost check is commented out, so promoting is free. Implement colcoins or drop them, and the column, from the model.
- [ ] **[3] Browser end-to-end tests in CI** *(new)*: CI runs unit and integration tests only. A few puppeteer flows (sign up, write, suggest, merge, critique across versions) would catch breakage between the frontend and the API.
- [ ] **[3] Contributor docs** *(new)*: `CONTRIBUTING.md`, a code of conduct and issue templates, for an AGPL project meant to attract outside contributors and institutions.
- [ ] **[3] Topic text** (design doc open question): decide whether a topic's text can be critiqued, or becomes a collective summary of the discussion (see the LLM item below).
- [ ] **[3] Multi-author posts** (thesis ch. 5): let an author add co-authors who commit directly instead of suggesting. The synthesis design already credits every commit author as a contributor.

## 1–2: nice to have, or reconsider

- [ ] **[2] `relativeTime` doesn't round years** (`AGENTS.md`): it shows "1.04… ano". Drop the `.fails` in `frontend/test/assets/util.test.js` once fixed.
- [ ] **[2] Configurable time zone** *(new)*: `America/Recife` is hardcoded in compose, and promotions expire at the server's midnight. Make it an `.env` setting.
- [ ] **[2] Custom themes** (README).
- [ ] **[2] Past promoted topics** (thesis ch. 5): a view of the most promoted topics on past days.
- [ ] **[2] LLM topic summaries** (thesis ch. 5 "machine learning", design doc answer): summarise the discussion into the topic text. First settle what triggers a summary and how to resist prompt injection from posts. Keep it optional per instance so self-hosting doesn't require a model provider.
- [ ] **[2] Interface translations** *(new)*: UI and API messages are Portuguese-only. Extract strings if instances outside Brazil become a goal.
- [ ] **[1] Protocol Buffers instead of JSON** (thesis ch. 5): probably not worth it. gzip is already on, and the real payload problem (versions sent for anchoring) is solved by `critique_anchors`. Consider dropping it.

## Done since the thesis

These are listed as future work in `docs/5_conclusoes.tex` and are already done: nginx reverse proxy, Docker deployment, automated unit and integration tests, and the user page. The thesis's "merge between different posts" isn't done: it becomes the synthesis in phase 5. Update the conclusions chapter if it will be reused.

## Decisions

1. **Syntheses get their own poll column** (2026-10-07). How it should work:
    - A synthesis has `config.answer: null` and `config.sources`. Once a topic has one, its poll gets a "síntese" column that adds up the votes on every synthesis, the same way each answer's column adds up its posts.
    - **Groups for the bridging score:** a voter's group is the last of the topic's own answers they voted for. Moving your vote to a synthesis keeps that group, so a synthesis can still be scored by how each side rates it. Someone who has only ever voted for syntheses is in no group, like someone who hasn't voted.
    - **Convergence, the headline number:** the topic page shows where a synthesis's votes came from ("18 vieram do sim, 11 do não, 4 novos"). People leaving their side for a synthesis is the measurable sign that the dialectic worked. It needs the vote history task below.
    - **Provenance is shown, never counted:** each synthesis lists its sources by answer ("cita 3 posts do sim e 2 do não") with the source authors' fairness marks. Nothing moves votes between columns.
    - **A topic setting "aceita sínteses"** (on by default): off for questions whose outcome must be one of the fixed answers, such as a binding yes/no consultation.
    - **Why not weights:** weighting by influence would add a synthesis's votes to answers its voters didn't pick. "Influence" (e.g. the share of quoted text) can also be gamed by quoting more.
2. **The next pilot is meant to be as large and open as possible**, so the anti-abuse items keep their 8–9 scores.
3. **gov.br is a real but distant target:** verification goes behind a provider interface now, and gov.br comes later.
4. **Poll votes are public** (2026-10-07), as in a forum: each post shows who voted for it, and a synthesis's "where its votes came from" numbers show at any size. This needs the consent task above.
5. **The first pilot has no institution behind it:** disputed topics thrive outside universities, so the pilot is open and relies on invite chains, proof-of-work, email verification and probation, not an email domain.
6. **No appointed moderators:** reports go to random community juries. An instance operator acts only on legal takedowns, in a public log.

## Open questions

1. **Jury duty** (undecided): optional with a prestige reward, or do picked users who don't vote lose eligibility for a while? Suggestion: start optional with the reward, since it's simpler and punishes no one, and track how often juries fail to reach quorum. Add the eligibility penalty only if they often do.
