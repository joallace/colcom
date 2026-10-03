import { Table, TableCell, TableHeader, TableRow } from "@tiptap/extension-table"
import Document from "@tiptap/extension-document"
import Heading from "@tiptap/extension-heading"
import { Placeholder } from "@tiptap/extensions"
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
      heading: false,
      // Added to the starter kit in TipTap 3. Disabled to keep the document schema as it was:
      // trailingNode would also append an empty paragraph to every document it loads.
      link: false,
      underline: false,
      trailingNode: false
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
