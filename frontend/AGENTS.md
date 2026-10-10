# colcom frontend

React 19 + React Router 7 + TipTap 3, built with Vite 8. Read the root [`AGENTS.md`](../AGENTS.md) first for what colcom is and its content model. UI text is Portuguese.

## Layout

| Path | What it holds |
|---|---|
| `src/pages/` | Routes (see `App.jsx`); `PostPage.jsx` is the most complex: versions, critiques, suggestions |
| `src/components/content/` | Topic, Post and Critique, their compact previews for the profile, bookmarks and search (`ContentList`, `PostPreview`, `CritiquePreview`, `Excerpt`), `CritiquePopover`, and tags (`TagPill`, `TagList`, `TagInput`) |
| `src/components/Editor/` | The TipTap editor, its extensions, menus and the chart node |
| `src/components/primitives/` | `Frame` (the card every content is drawn in), `Modal`, `Popover`, `Pagination`, voting buttons… |
| `src/assets/` | Logic shared across components: the API client `api.js`, `anchoring.js`, `textDiff.js`, `textIndex.js`, the custom `highlight.js` mark, `validation.js`, and `scss/` |
| `src/hooks/` | `useApiResource` (page loads), `usePageParam`, `useToLogin`, `useUnreadNotifications`, `useBreakpoint` |
| `src/context/` | `UserContext`/`UserProvider` (the logged-in user and token, from `localStorage`; `logout` revokes the session on the API and forgets it without waiting, the session is checked again on returning to the tab, and it logs out when the API refuses a request's token) and `ChartContext`/`ChartProvider` |

`@/` is an alias for `src/`. The API address is `import.meta.env.VITE_API_ADDRESS` (`assets/enviroment.js`), or when unset `http://localhost:3000` in dev and the relative `/api` in a build (nginx proxies it on the same origin). Only `assets/api.js` prefixes it to paths, so a relative address works. nginx's CSP (`nginx/headers.conf`) allows only same-origin scripts, styles, fonts and requests, plus `data:` images, and no eval: anything loaded from elsewhere must be added there.

## The editor (TipTap 3)

- **One extension list.** `components/Editor/extensions.js` is used both by the editor and by `assets/anchoring.js`, which must parse a post's HTML into exactly the document the editor shows. Change the schema there and nowhere else.
- **Schema parity.** StarterKit's `link`, `underline` and `trailingNode` are disabled to keep the document schema stable. `trailingNode` would also append an empty paragraph to every document.
- **TipTap 3 pitfalls already solved; keep them solved:**
  - `useEditor` compares extensions by identity on every render and reconfigures the editor when they differ, which re-renders again. Build the list once (`useMemo`), or the post page loops forever.
  - The editor doesn't re-render on every transaction (`shouldRerenderOnTransaction` is off). Components that show editor state subscribe with `useEditorState`, as the menus do through `useActiveFormats`.
  - `immediatelyRender: false`: the editor is created after mount, so `editor` can be `null` on first render. This keeps React node views (charts) from forcing a synchronous flush mid-render.
  - The bubble menu's plugin leaves timers running after it unmounts, and a late timer re-shows its emptied element: an orange dot stuck over the text. `BubbleMenu.jsx` guards its `shouldShow` with an "is rendered" ref; keep that guard.
  - Menus come from `@tiptap/react/menus` and position themselves with Floating UI (`@floating-ui/dom` is a required peer dependency).
- **Highlights.**
  - Critique highlights are a custom `highlight` mark (`assets/highlight.js`). Its `data-commit-index` holds the critique's index, or a JSON list for overlapping critiques shown as one group.
    - Each group is split into segments by how many of its critiques cover them (`densitySegments`, called by `groupOverlappingMarks`, both in `assets/critiqueDensity.js`). Every segment carries the group's `data-commit-index`, so clicking any of them opens the whole group, and the popover anchors to the first one.
    - A segment's `data-level` (1–5) puts its count on a doubling scale (1, 2, 3–4, 5–8, 9+; `CRITIQUE_LEVELS`), shaded from faint orange to vivid red by the `critique-density` mixin in `_text_editor.scss`. When some segment has 2 + critiques, a legend above the post (`.critiqueLegend`) shows the scale; its swatches are `<span>`s, not `<mark>`s, so highlight selectors never match them. "Changed" segments keep their shade and add a dashed underline.
    - Charts are atom blocks, which marks can't cover, so a chart carries its highlight as node attributes (`highlight`, `highlightIndex`, `highlightLevel`, rendered as `data-highlight`, `data-commit-index` and `data-level`) and `ChartNodeView` draws it as an outline. `editor.commands.highlightRange({ from, to }, attributes)` highlights text and charts alike, and like `setMark` keeps the attributes it isn't given: an opened critique's passage turns temporary but keeps the `data-commit-index` the popover finds it by.
  - Suggestion changes are drawn by `DiffHighlight.js` as decorations (never document changes), set through `editor.commands.setDiffBase(html)`.

## Critique anchoring (`assets/anchoring.js`)

A critique stores `{ commit, from, to }` (ProseMirror positions in that version) and `quote: { exact, prefix, suffix, start }`, where `start` is the offset in `textIndex`'s text. `textIndex` flattens a document to text with blocks separated by `\n` and maps each character to its ProseMirror position. A chart stands in that text as one character (`CHART_TEXT`, U+FFFC), so it can be quoted and followed like a word; `readableText` shows it as "[gráfico]". Edits to a chart's data don't change that character, so they don't mark its critiques "changed".

`projectCritiques(html, critiques, commit, versions, lineages)` adds an `anchor` to each critique: `{ from, to, match: "exact" | "fuzzy" }` or `{ match: "removed" }`.

1. **On its own version:** the stored positions are used as they are.
2. **On a later version:** the passage is followed through each version in its lineage, with a word-level diff per step (`textDiff.diffWords`, which encodes words as single characters for `fast-diff` and runs a semantic cleanup).
   - At least half of the passage must survive each step (`MIN_KEPT_RATIO`); otherwise it's removed and stays removed.
   - Repeated text makes diffs ambiguous: deleting a copy right after the passage looks the same as cutting the passage's end. So when the quote still appears word for word near the followed range, the passage snaps to it (`snapToQuote`).
3. **Without the versions in between:** the quote is searched for instead (`findQuote`: exact text scored by its context, then the text between the context, then approximate matches with `approx-string-match`).

"Fuzzy" means the passage's words changed; it's drawn with a dashed underline. Removed critiques are listed below the post. When changing any of this, test with repetitive text (Lorem Ipsum repeated), passages spanning paragraphs, and passages removed and then followed by similar text; `test/assets/anchoring.test.js` has cases of each, and new ones belong there.

## Post page state (`pages/PostPage.jsx`)

- **The URL decides what's shown.** `?commit=<hash>` picks the version (absent means the latest); the slider and the critiques' links only change the URL, and a single effect fetches what it says. A request counter discards responses that arrive after a newer request.
- **Opening a critique from a link.** `?critique=<id>` (used by profile and bookmark links) opens that critique once its highlight exists, together with any overlapping critiques, and scrolls to it.
- **Projection is derived.** `critiques` is computed with `useMemo` from the fetched body, critiques, `versions` and `lineages`; it's never stored.
- **`showCritique`** holds what's open: a new critique's `[from, to]` selection, a critique's index as a string, or a JSON list of indexes (a group).
- **Critique placement (desktop).** `CritiquePopover` places the open critiques beside the post, level with the passage, using Floating UI (`autoUpdate`, `shift` bounded by the post frame so they never cover the timeline). Being absolutely positioned, the popover takes no room in the page, so it reports where it ends (its `reservedHeight` middleware) and its column is stretched to that height, pushing the footer below a long stack; the list of removed passages sits in the post's column, under the post. On phones, critiques open in a `Modal`.
- **Reviewing a suggestion.** It loads the suggestion's commit; the response's `base` (the version it branched from) is passed to the editor as `diffBase`, and no critiques are highlighted over it (closing it loads a version again, which brings them back). Accepting one that conflicts (a 409 `GIT:MERGE:CONFLICT`) goes to its resolution page; other refusals are shown under the post.

## Resolving a suggestion's conflicts (`pages/ResolveSuggestion.jsx`)

At `/topics/:tid/posts/:pid/suggestions/:hash`, for the post's author. It loads `GET /contents/:id/:hash/merge` and runs the same `merge3` the backend does (`assets/mergeConflicts.js` wraps it), so it shows exactly the conflicts the API refused.

- **Choosing.** Each conflict shows the author's version and the suggestion side by side, as read-only editors highlighting what each changed from the base (`diffBase`, with `diffLabel={null}` to drop the per-editor legend), between the plain text of the blocks around it (`conflictContexts`). Radios pick "ours", "theirs" or "both" (the author's first); `resolveChunks` joins the result.
- **Reviewing.** The result opens in an editable editor compared with the post's current version. Like the post's edits, the editor hands its content over on blur, before the button's click.
- **Sending.** `{ body, head }` goes to `POST …/merge`. A `GIT:MERGE:HEAD_MOVED` refusal (the post changed meanwhile) offers to start over, loading the sides again.

## Talking to the API

Every request goes through `assets/api.js`; nothing else calls `fetch`.

- **`api.get(path, opts)`, `api.post/patch(path, body, opts)`** take a path (`/contents/1`), send the body as JSON and return the parsed answer (`undefined` for a 204 or an empty body). Other options (`signal`, `keepalive`) go to `fetch`.
- **The token** is read from `localStorage` on each request, its single source of truth (`UserProvider` writes and removes it there; `user.accessToken` only identifies whose data was loaded). `auth: false` sends none (login and sign-up); `token` sends a given one (logging out, after it's forgotten).
- **A refusal** throws an `ApiError` with `status`, the body's `message`, `action`, `key`, `errors` and `errorLocationCode`, and the whole body in `data` (for `responseErrors(err.data)`). A failed connection throws `fetch`'s own error, so `err instanceof ApiError` tells a refusal from no connection.
- **A 401 to a request that sent the stored token** dispatches `SESSION_ENDED_EVENT`, and `UserProvider` logs out: the backend answers a revoked or expired token so, and a page must not take anonymous data as the user's. Login and sign-up send no token, so a wrong password never logs anyone out.
- **Page loads** use `hooks/useApiResource(path, { deps })`: `{ data, error, isLoading, setData, reload }`. A null path waits (e.g. while `user` is undefined); it fetches again when `deps` change (by default the path), aborting the previous request, and `data`/`error` are only ever the answer to what's asked now. The path is read when the deps change, so a part left out of them (TopicTree's `with_count`) doesn't refetch. Requests made by actions (votes, forms) and the post page's versions call `api` directly.

## Forms

Forms validate with the schemas the API uses (`shared/`, see the root `AGENTS.md`) through `assets/validation.js`, before sending anything:

- The schemas are compiled at build time by a Vite plugin (`plugins/validators.js`, imported as `virtual:validators`), because the CSP forbids the eval Ajv compiles with. Restart the dev server after changing `shared/`.
- `formErrors(schema, values)` returns `{ field: message }`, treating an empty field as missing; `validate` and `describe` give the full errors and the API's sentence; `limits` sets inputs' `maxLength`.
- `responseErrors(data)` reads the API's `errors` list (or its single `key`), so the same messages appear next to the fields whatever found them.
- Messages are short and lowercase ("campo obrigatório"); inputs show them with a "!", as the rest of the UI does.

## Other things to know

- **Sending to the login.** Use `useToLogin()` (or `loginPath(location)` for `<Navigate>`/`<Link>`), never a bare `/login`: it adds `?returnTo=` with the current address and forwards the router state, and the login page goes back there (through `returnPath`, which only accepts paths on this site) after logging in. Signing up turns the form into the login on the same address, so `returnTo` survives it. `submitVote` takes the hook's function.
- **Notifications.** The navbar's bell (`layout/NotificationBell`) shows the unread count from `hooks/useUnreadNotifications.js`, which asks the API on every navigation, every minute while the tab is visible and on returning to it. A page that changes the count calls `announceUnread` (`assets/notifications.js`, through `markRead`), and the badge follows at once. `describeNotification` turns each one into its sentence and link, drawn by `content/NotificationItem`. Clicking the bell opens a popover with the latest five, fetched on each opening, and a link to `/notifications`, which lists them all; both mark one read when it's opened.
- **Popovers.** `primitives/Popover` (`@floating-ui/react`) is a button that opens a panel beside it: it flips and shifts to stay on screen, closes on a second click, a click outside or Escape (returning the focus to the button), and is a `dialog` named by its `heading`. Its `content` mounts only while open, so it can fetch then; as a function it receives `{ close }` for links that navigate away. The panel is drawn in a portal, so style it through `panelClassName`, not from the trigger's ancestors.
- **Tags.** `TagList`, under each topic's title, shows its visible tags as `TagPill`s (links to `/t/<slug>`; dashed while provisional, outlined in orange when reserved, tinted green or red by the viewer's vote), the first five and a "+N". Its last pill opens a `Popover` with every proposed tag, its counts, endorse and contest buttons (pressing the active one withdraws) and a `TagInput` to propose one. `TagInput` is a combobox that suggests tags from `GET /tags?q=` and offers to create the typed name, validated with the shared `tagVote` schema; the new topic form uses it too. `/t/a+b` (`pages/TagTopics`) is a `TopicTree` filtered by those tags, headed by the tags (each removable) and the related ones (each added on a click); a merged tag's page redirects to its tag. A reserved tag has no vote buttons in the panel. Helpers are in `assets/tags.js`.
- **Search.** `/search?q=…&tags=a,b&type=topic|post&p=…` (`pages/Search`) lists `GET /search`'s results with `ContentList`, under a field (`layout/SearchBox`) and links to show everything, topics or posts. The navbar has the same field on large screens and a link to the page on smaller ones, both left out on the page itself.
  - **Tags in the field.** Words search titles and texts; tags only through a "#". The "#word" at the caret (`hashtagAt`) is a combobox: it suggests tags from `GET /tags?q=` (the most used for a bare "#"), and picking one (click, Enter or Tab while the list is open) turns it into a pill. Enter with the list closed searches: the pills, plus any "#tag" typed in full (`splitQuery`, by slug), go as `tags`, an intersection like `/t/a+b`, up to the filter limit. Backspace at the field's start removes the last pill. The page names pills loaded from the address with the `tags` the API sends back. Each result's `excerpt` marks the matched words with U+E000/U+E001; `excerptParts` (`assets/search.js`) splits it so `content/Excerpt` draws `<mark>`s without parsing HTML. A post shows it in place of its summary, and a topic under its tags, only when the text itself matched (`hasMatch`); a match in the title, or a search by tags alone, leaves them as lists show them. `Pagination`'s `path` may carry a query (`p` is added with `&`).
- **Meta.** `/meta` (`pages/Meta`) lists the foundational topics from `GET /meta` under their groups' headings, whole and in order, without pagination; empty groups are left out.
- **A topic's text.** `Topic` shows the topic's own body (sanitized) only with `showBody`, which the topic page passes; lists leave it out.
- **Writing a post.** `/write?topic=<id>` takes its topic from the router state when the topic page opened it and fetches it otherwise, so it opens from a link or a reload. Unpublished drafts are kept per topic (`assets/drafts.js`, keys `draft:<topicId>:title|body`).
- **`Frame` props.** `Frame` passes its header state to a *single* child through `cloneElement`; arrays and Fragments are rendered as they are. Wrapping an `Editor` together with something else changes which props it receives.
- **Overlays.** `Modal` is a `<dialog>` opened with `showModal()`: the top layer puts it over the whole page even inside transformed ancestors (the critique popover), while it stays in its parent's DOM, so outside-click checks and node views still see its events. It closes only by its `isOpen` turning false; Escape and the X call `setIsOpen(false)`. jsdom has no `showModal`; `test/setup.js` stubs it.
- **Rendering HTML.** User-written HTML is only rendered through the editor or `DOMPurify.sanitize`. To parse HTML outside the editor, use `new DOMParser().parseFromString(...)`, which never runs handlers like `<img onerror>`; never assign it to `innerHTML`.
- **Styles.** SCSS partials are imported by `assets/scss/main.scss`, base layers first. Style with the CSS custom properties in `core/_tokens.scss`, built from the Sass constants in `abstracts/_variables.scss`; those constants are only for Sass math and for what `_export.module.scss` hands to JavaScript.
  - **Colors:** surfaces by elevation (`--bg`, `--surface`, `--surface-raised`), text (`--text`, `--text-secondary`, `--text-muted`, all at least 4.5:1 on every surface), brand fills and outlines (`--green`, `--orange`, `--red`) and their lighter `-text` variants for text and icons, since the fills lack contrast as text. Translucent `-tint`s, `--hover` and `--pressed` mark states over any surface.
  - **Space and type:** `--space-1`…`--space-8` (a 4px grid), `--text-xs`…`--text-title`, `--radius-*`, `--shadow-*`. Pages are one centered column in `.content` (`--measure`, or `--measure-wide` with `.wide`) inside `--gutter`; components take `min(100%, max)` widths through the `content-width` mixin, not `vw`.
  - **Motion:** transition named properties with the `transition` mixin, never `all`. Use `--duration-*` with `--ease-out` for things arriving and `--ease-spring` for playful pops; entrances are keyframes in `core/_motion.scss`. Durations are zero under `prefers-reduced-motion`, so use the tokens, not literal durations. Animate `opacity` and `transform` only, and never animate an element Floating UI positions (it uses `transform`): animate its children.
  - **Focus:** `:focus-visible` draws the ring (`focus-ring` mixin); don't remove outlines without a replacement.
- **Lint.** `npm run lint` is clean; keep it so. `react/prop-types` is off (React 19 ignores `propTypes`). `eslint-plugin-react-hooks` 7 includes the React Compiler rules:
  - An effect that should run only when one value changes, but reads others, calls a `React.useEffectEvent` rather than leaving dependencies out.
  - Don't set state synchronously in an effect. Derive the value (list pages compare what they loaded with what's asked for), or adjust it during render (`hooks/usePageParam.js`).
  - Files export either components or other things, never both (fast refresh). Contexts live apart from their providers (`context/UserContext.jsx` and `UserProvider.jsx`), and helpers live in `src/assets/` (`interactions.js`, `pixelArt.js`).
  - ESLint stays on v9 until `eslint-plugin-react` supports v10.

## Tests

`npm test` runs Vitest with jsdom (`vitest.config.js` extends `vite.config.js`, so `@/` works). Tests live in `test/`, mirroring `src/`.

- **Logic first.** Keep logic that can be tested without React in `src/assets/` (as `groupOverlappingMarks` is), and test it there.
- **The real editor works in jsdom.** `new Editor({ extensions: getExtensions(), … })` renders marks and decorations; `test/editor/` does this.
- **API calls are stubbed** with `vi.stubGlobal("fetch", …)`; `test/setup.js` restores globals and clears `localStorage` after each test. The API address in tests is `http://api.test`. A test providing a user through `UserContext` stores its token too (`storeToken` in `test/support/session.js`), since the client reads it from `localStorage`.
- **Pages need their providers:** `UserContext`, `ChartProvider` (charts) and a `MemoryRouter` with the page's route, as in `test/pages/PostPage.test.jsx`.
