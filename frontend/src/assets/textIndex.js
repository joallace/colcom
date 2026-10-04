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
    else if (node.isBlock || node.type.name === "hardBreak")
      separate()
  })

  return { text, positions }
}
