# colcom frontend

React 19 + React Router 7 + TipTap 3, built with Vite 8. Read the root [`AGENTS.md`](../AGENTS.md) first for what colcom is and its content model. UI text is Portuguese.

## Layout

| Path | What it holds |
|---|---|
| `src/pages/` | Routes (see `App.jsx`); `PostPage.jsx` is the most complex: versions, critiques, suggestions |
| `src/components/content/` | Topic, Post and Critique, their compact previews for the profile and bookmarks (`ContentList`, `PostPreview`, `CritiquePreview`), and `CritiquePopover` |
| `src/components/Editor/` | The TipTap editor, its extensions, menus and the chart node |
| `src/components/primitives/` | `Frame` (the card every content is drawn in), `Modal`, `Pagination`, voting buttons… |
| `src/assets/` | Logic shared across components: `anchoring.js`, `textDiff.js`, `textIndex.js`, the custom `highlight.js` mark, and `scss/` |
| `src/context/` | `UserContext` (the logged-in user and token, from `localStorage`) |

`@/` is an alias for `src/`. The API address is `import.meta.env.VITE_API_ADDRESS` (`assets/enviroment.js`).

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
  - Suggestion changes are drawn by `DiffHighlight.js` as decorations (never document changes), set through `editor.commands.setDiffBase(html)`.

## Critique anchoring (`assets/anchoring.js`)

A critique stores `{ commit, from, to }` (ProseMirror positions in that version) and `quote: { exact, prefix, suffix, start }`, where `start` is the offset in `textIndex`'s text. `textIndex` flattens a document to text with blocks separated by `\n` and maps each character to its ProseMirror position.

`projectCritiques(html, critiques, commit, versions, lineages)` adds an `anchor` to each critique: `{ from, to, match: "exact" | "fuzzy" }` or `{ match: "removed" }`.

1. **On its own version:** the stored positions are used as they are.
2. **On a later version:** the passage is followed through each version in its lineage, with a word-level diff per step (`textDiff.diffWords`, which encodes words as single characters for `fast-diff` and runs a semantic cleanup).
   - At least half of the passage must survive each step (`MIN_KEPT_RATIO`); otherwise it's removed and stays removed.
   - Repeated text makes diffs ambiguous: deleting a copy right after the passage looks the same as cutting the passage's end. So when the quote still appears word for word near the followed range, the passage snaps to it (`snapToQuote`).
3. **Without the versions in between:** the quote is searched for instead (`findQuote`: exact text scored by its context, then the text between the context, then approximate matches with `approx-string-match`).

"Fuzzy" means the passage's words changed; it's drawn with a dashed underline. Removed critiques are listed below the post. When changing any of this, test with repetitive text (Lorem Ipsum repeated), passages spanning paragraphs, and passages removed and then followed by similar text.

## Post page state (`pages/PostPage.jsx`)

- **The URL decides what's shown.** `?commit=<hash>` picks the version (absent means the latest); the slider and the critiques' links only change the URL, and a single effect fetches what it says. A request counter discards responses that arrive after a newer request.
- **Opening a critique from a link.** `?critique=<id>` (used by profile and bookmark links) opens that critique once its highlight exists, together with any overlapping critiques, and scrolls to it.
- **Projection is derived.** `critiques` is computed with `useMemo` from the fetched body, critiques, `versions` and `lineages`; it's never stored.
- **`showCritique`** holds what's open: a new critique's `[from, to]` selection, a critique's index as a string, or a JSON list of indexes (a group).
- **Critique placement (desktop).** `CritiquePopover` places the open critiques beside the post, level with the passage, using Floating UI (`autoUpdate`, `shift` bounded by the post frame so they never cover the timeline). The `.critiques` column only reserves width. On phones, critiques open in a `Modal`.
- **Reviewing a suggestion.** It loads the suggestion's commit; the response's `base` (the version it branched from) is passed to the editor as `diffBase`.

## Other things to know

- **`Frame` props.** `Frame` passes its header state to a *single* child through `cloneElement`; arrays and Fragments are rendered as they are. Wrapping an `Editor` together with something else changes which props it receives.
- **Rendering HTML.** User-written HTML is only rendered through the editor or `DOMPurify.sanitize`. To parse HTML outside the editor, use `new DOMParser().parseFromString(...)`, which never runs handlers like `<img onerror>`; never assign it to `innerHTML`.
- **Styles.** SCSS partials are imported by `assets/scss/main.scss`; colors come from `abstracts/_variables.scss` (`$default-orange`, `$default-green`, …) and widths from the `content-responsiveness` mixin.
- **Lint.** `npm run lint` already reports many errors, mostly `react/prop-types`, plus React Compiler advisories from `eslint-plugin-react-hooks` 7. Don't add new ones. ESLint stays on v9 until `eslint-plugin-react` supports v10.
