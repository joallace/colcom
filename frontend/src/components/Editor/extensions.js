import Table from "@tiptap/extension-table"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import TableRow from "@tiptap/extension-table-row"
import Document from "@tiptap/extension-document"
import Heading from "@tiptap/extension-heading"
import Placeholder from "@tiptap/extension-placeholder"
import StarterKit from "@tiptap/starter-kit"
import CustomHighlight from "@/assets/highlight"

import Chart from "@/components/Editor/TipTapChart"


// Shared by the editor and by critique anchoring (assets/anchoring.js), which must parse a post's
// HTML into exactly the same document the editor shows, or critique positions would not match.
export default function getExtensions({ setShowCritique } = {}) {
  return [
    Document,
    StarterKit.configure({
      document: false,
      heading: false
    }),
    Chart,
    Table,
    TableCell,
    TableHeader,
    TableRow,
    Heading.configure({
      levels: [2, 3],
    }),
    CustomHighlight.configure({ setShowCritique }),
    Placeholder.configure({
      placeholder: "O que tens a dizer?"
    })
  ]
}
