import { Extension } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"
import { DOMParser as SchemaParser } from "@tiptap/pm/model"

import textIndex, { readableText } from "@/assets/textIndex"
import { diffWords, diff } from "@/assets/textDiff"


export const diffHighlightKey = new PluginKey("diffHighlight")

// Where text removed at `offset` of the current text is shown: right after the character before it
function boundary({ positions }, offset) {
  for (let i = offset - 1; i >= 0; i--)
    if (positions[i] !== null)
      return positions[i] + 1
  for (let i = offset; i < positions.length; i++)
    if (positions[i] !== null)
      return positions[i]
  return 0
}

// Inline decorations over [start, end) of the current text, one per run of adjacent characters
function inserted({ positions }, start, end) {
  const decorations = []
  let from = null, to = null

  for (let i = start; i <= end; i++) {
    const pos = i < end ? positions[i] : null
    if (pos !== null && pos === to) {
      to = pos + 1
      continue
    }
    if (from !== null)
      decorations.push(Decoration.inline(from, to, { class: "diffInsert" }))
    from = pos
    to = pos === null ? null : pos + 1
  }

  return decorations
}

function removed(text) {
  const element = document.createElement("span")
  element.className = "diffDelete"
  // Removed block breaks are shown as pilcrows, since the blocks themselves aren't there anymore
  element.textContent = readableText(text).replace(/\n+/g, " ¶ ")
  return element
}

function diffDecorations(doc, baseHtml) {
  const dom = new window.DOMParser().parseFromString(baseHtml, "text/html")
  const base = textIndex(SchemaParser.fromSchema(doc.type.schema).parse(dom.body))
  const current = textIndex(doc)
  const decorations = []
  let newPos = 0

  for (const [operation, text] of diffWords(base.text, current.text)) {
    if (operation === diff.EQUAL)
      newPos += text.length
    else if (operation === diff.INSERT) {
      decorations.push(...inserted(current, newPos, newPos + text.length))
      newPos += text.length
    }
    else if (text.trim())
      decorations.push(Decoration.widget(boundary(current, newPos), () => removed(text), { side: -1, ignoreSelection: true }))
  }

  return DecorationSet.create(doc, decorations)
}

// Shows what the document changes relative to a base version: added words highlighted, removed
// ones struck through where they were. Used to review a suggestion against the version it was made
// on. Decorations don't touch the document, so critique positions stay valid; they're recomputed
// whenever the document or the base changes (e.g. the editor reloading its highlights).
export default Extension.create({
  name: "diffHighlight",

  addStorage() {
    return { base: null }
  },

  addCommands() {
    return {
      // Sets the HTML of the version to compare against (null stops highlighting) and redraws
      setDiffBase: base => ({ tr, dispatch }) => {
        this.storage.base = base
        if (dispatch)
          tr.setMeta(diffHighlightKey, true)
        return true
      }
    }
  },

  addProseMirrorPlugins() {
    const storage = this.storage
    let cache = { doc: null, base: null, decorations: DecorationSet.empty }

    return [
      new Plugin({
        key: diffHighlightKey,
        props: {
          decorations(state) {
            if (!storage.base)
              return DecorationSet.empty

            if (cache.doc !== state.doc || cache.base !== storage.base)
              cache = { doc: state.doc, base: storage.base, decorations: diffDecorations(state.doc, storage.base) }

            return cache.decorations
          }
        }
      })
    ]
  }
})
