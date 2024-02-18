import { Mark, mergeAttributes } from "@tiptap/core"

export default Mark.create({
  name: "highlight",
  addOptions() {
    return {
      multicolor: false,
      HTMLAttributes: {},
    }
  },
  addAttributes() {
    if (!this.options.multicolor) {
      return {}
    }
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
    return ["mark", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
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
    }
  }
})
