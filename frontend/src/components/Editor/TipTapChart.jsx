import { ReactNodeViewRenderer } from '@tiptap/react'
import { mergeAttributes, Node } from '@tiptap/core'

import ChartNodeView from "@/components/Editor/ChartNodeView"

export default Node.create({
  name: 'chart',
  group: 'block',
  atom: true,

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
      }
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