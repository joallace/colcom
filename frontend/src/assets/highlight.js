import { Mark, mergeAttributes } from "@tiptap/core"

export default Mark.create({
  name: "highlight",
  addOptions() {
    return {
      setShowCritique: () => { },
      HTMLAttributes: {},
    }
  },
  addAttributes() {
    return {
      type: {
        default: "definitive",
        parseHTML: element => element.getAttribute("class"),
        renderHTML: attributes => {
          if (!attributes.type) {
            return {}
          }
          return {
            "class": attributes.type
          }
        },
      },
      index: {
        parseHTML: element => element.getAttribute("data-commit-index"),
        renderHTML: attributes => {
          if (attributes.index === undefined) {
            return {}
          }
          return {
            "data-commit-index": attributes.index
          }
        },
      },
      // How many critiques cover this piece of text, as a step of a coarse scale (critiqueLevel)
      level: {
        parseHTML: element => element.getAttribute("data-level"),
        renderHTML: attributes => {
          if (attributes.level === undefined) {
            return {}
          }
          return {
            "data-level": attributes.level
          }
        },
      }
    }
  },
  parseHTML() {
    return [
      {
        tag: "mark",
      },
    ]
  },
  renderHTML({ HTMLAttributes }) {
    const element = document.createElement('mark')

    Object.entries(
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)
    ).forEach(([attr, val]) => element.setAttribute(attr, val))

    element.addEventListener("click", () => {
      this.options.setShowCritique(element.getAttribute("data-commit-index"))
    })

    return element
  },
  addCommands() {
    return {
      setHighlight: attributes => ({ commands }) => {
        return commands.setMark(this.name, attributes)
      },
      toggleHighlight: attributes => ({ commands }) => {
        return commands.toggleMark(this.name, attributes)
      },
      unsetHighlight: () => ({ commands }) => {
        return commands.unsetMark(this.name)
      },
      // Highlights [from, to) without moving the selection. Marks only cover text, so the charts in
      // the range carry the highlight as their own attributes instead (see TipTapChart). As setMark
      // does, attributes left out are kept: an opened critique's passage turns temporary but keeps
      // its index, which the critique popover is anchored by.
      highlightRange: ({ from, to }, attributes = {}) => ({ tr, dispatch }) => {
        if (dispatch)
          // Neither change moves any position, so the original document can be walked while changing it
          tr.doc.nodesBetween(from, to, (node, pos) => {
            if (node.isText) {
              const current = this.type.isInSet(node.marks)?.attrs
              tr.addMark(Math.max(pos, from), Math.min(pos + node.nodeSize, to), this.type.create({ ...current, ...attributes }))
            }
            else if (node.type.name === "chart")
              tr.setNodeMarkup(pos, undefined, {
                ...node.attrs,
                highlight: attributes.type ?? node.attrs.highlight ?? "definitive",
                highlightIndex: attributes.index ?? node.attrs.highlightIndex,
                highlightLevel: attributes.level ?? node.attrs.highlightLevel
              })
          })
        return true
      },
    }
  }
})