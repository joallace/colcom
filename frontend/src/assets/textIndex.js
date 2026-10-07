// Charts have no text, but can be criticised and must be followed across versions like any passage.
// Each one stands in the text as this character (the Unicode object replacement character).
export const CHART_TEXT = "￼"

// A quote as readers see it, with charts named rather than drawn as the replacement character
export const readableText = text => text.replaceAll(CHART_TEXT, "[gráfico]")

// The document's text, with blocks separated by "\n", and the ProseMirror position of each character
// (null for the separators). Quotes are searched in this text and mapped back to positions.
export default function textIndex(doc) {
  let text = ""
  const positions = []

  const separate = () => {
    if (text && !text.endsWith("\n")) {
      text += "\n"
      positions.push(null)
    }
  }

  doc.descendants((node, pos) => {
    if (node.isText) {
      text += node.text
      for (let i = 0; i < node.text.length; i++)
        positions.push(pos + i)
    }
    else if (node.type.name === "chart") {
      separate()
      text += CHART_TEXT
      positions.push(pos)
    }
    else if (node.isBlock || node.type.name === "hardBreak")
      separate()
  })

  return { text, positions }
}
