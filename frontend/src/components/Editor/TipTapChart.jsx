import { ReactNodeViewRenderer } from '@tiptap/react'
import { mergeAttributes, Node } from '@tiptap/core'

import ChartNodeView from "@/components/Editor/ChartNodeView"

const htmlAttribute = (key, name) => ({
  default: null,
  parseHTML: element => element.getAttribute(name),
  renderHTML: attributes => attributes[key] == null ? {} : { [name]: attributes[key] }
})

export default Node.create({
  name: 'chart',
  group: 'block',
  atom: true,

  addOptions() {
    return {
      setShowCritique: () => { }
    }
  },

  addAttributes() {
    return {
      "readOnly": {
        default: false
      },
      "data": {
        default: [],
      },
      "type": {
        default: "line"
      },
      "isLegendOn": {
        default: true
      },
      // A critique highlight, which as a mark would only cover text: its type, index and level, as the
      // highlight mark has them (assets/highlight.js). Kept in the HTML so it survives setContent.
      "highlight": htmlAttribute("highlight", "data-highlight"),
      "highlightIndex": htmlAttribute("highlightIndex", "data-commit-index"),
      "highlightLevel": htmlAttribute("highlightLevel", "data-level")
    }
  },

  parseHTML() {
    return [
      {
        tag: 'chart',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['chart', mergeAttributes(HTMLAttributes)]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ChartNodeView)
  },
})