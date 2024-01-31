import { Mark, mergeAttributes } from "@tiptap/core"

export default Mark.create({
  name: "highlight",
  addOptions() {
    return {
      multicolor: false,
      HTMLAttributes: {},
    };
  },
  addAttributes() {
    if (!this.options.multicolor) {
      return {};
    }
    return {
      type: {
        default: "definitive",
        parseHTML: element => element.getAttribute("data-type"),
        renderHTML: attributes => {
          if (!attributes.type) {
            return {};
          }
          return {
            "data-type": attributes.type
          };
        },
      },
      color: {
        default: null,
        parseHTML: element => element.getAttribute("data-color") || element.style.backgroundColor,
        renderHTML: attributes => {
          if (!attributes.color) {
            return {};
          }
          return {
            "data-color": attributes.color,
            style: `background-color: ${attributes.color}; color: inherit`,
          };
        },
      }
    };
  },
  parseHTML() {
    return [
      {
        tag: "mark",
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["mark", mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0];
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
    };
  }
});
