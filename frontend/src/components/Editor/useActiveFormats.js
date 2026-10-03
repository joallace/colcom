import { useEditorState } from "@tiptap/react"


// What the editor menus show (which formats are active, whether the document is empty). Only the
// menus re-render when one of these changes, instead of the whole editor on every transaction.
export default function useActiveFormats(editor) {
  return useEditorState({
    editor,
    selector: ({ editor }) => editor ? {
      bold: editor.isActive("bold"),
      italic: editor.isActive("italic"),
      heading2: editor.isActive("heading", { level: 2 }),
      heading3: editor.isActive("heading", { level: 3 }),
      bulletList: editor.isActive("bulletList"),
      orderedList: editor.isActive("orderedList"),
      blockquote: editor.isActive("blockquote"),
      chart: editor.isActive("chart"),
      table: editor.isActive("table"),
      isEmpty: editor.isEmpty
    } : {}
  }) ?? {}
}
