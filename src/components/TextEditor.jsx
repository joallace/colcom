import React from "react"

import {
  EditorContent,
  useEditor,
} from "@tiptap/react"
import Table from "@tiptap/extension-table"
import TableCell from "@tiptap/extension-table-cell"
import TableHeader from "@tiptap/extension-table-header"
import TableRow from "@tiptap/extension-table-row"
import Document from "@tiptap/extension-document"
import Heading from "@tiptap/extension-heading"
import Placeholder from "@tiptap/extension-placeholder"
import StarterKit from "@tiptap/starter-kit"
import CustomHighlight from "@/assets/highlight"

import Chart from "@/components/TipTapChart"
import ChartModal from "@/components/ChartModal"
import BubbleMenu from "@/components/BubbleMenu"
import FloatingMenu from "@/components/FloatingMenu"
import { ChartContext } from "@/context/ChartContext"


export default function TextEditor({
  content,
  setContent = () => { },
  saveInLocalStorage = false,
  readOnly = true,
  edit: isEditable = !readOnly,
  alongsideCritique,
  setShowCritique,
  tableConfig = { maxRows: 20, maxColumns: 10 },
  ...remainingProps
}) {
  const [modal, setModal] = React.useState(false)
  const { chartString, resetChartStr } = React.useContext(ChartContext)
  const editor = useEditor({
    extensions: [
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
      CustomHighlight.configure({
        multicolor: true
      }),
      Placeholder.configure({
        placeholder: "O que tens a dizer?"
      })
    ],
    editorProps: {
      handleDOMEvents: {
        drop: (_, e) => { e.preventDefault(); },
      }
    },
    onBlur: ({ editor }) => {
      if (saveInLocalStorage) {
        const editorContent = editor.getHTML()
        setContent(editorContent)
        localStorage.setItem("editorContent", editorContent)
      }
    },
    editable: isEditable,
    content: isEditable ? content : content.replace(/<chart readonly="false"/g, '<chart readonly="true"'),
  })

  const removeTempHighlight = obj => {
    if(obj.marks)
      for (let i = 0; i < obj.marks.length; i++)
        if (obj.marks[i].type === "highlight" && obj.marks[i].attrs.type === "temporary")
          obj.marks.splice(i, 1)

    if(obj.content)
      for(let i = 0; i < obj.content.length; i++)
        obj.content[i] = removeTempHighlight(obj.content[i])

    return obj
  }

  // If there is a change in the chartData string, it is an edition of a chart by the modal.
  // So we need to delete the old chart and insert the new string
  React.useEffect(() => {
    if (chartString.length !== 0) {
      editor.commands.deleteNode('chart')
      editor.chain().focus().insertContent(chartString).run()
      resetChartStr()
    }
  }, [chartString])

  React.useEffect(() => {
    if (editor) {
      editor.setEditable(isEditable)

      if (isEditable)
        editor.commands.setContent(editor.getHTML().replace(/<chart readonly="true"/g, '<chart readonly="false"'))
      else
        editor.commands.setContent(editor.getHTML().replace(/<chart readonly="false"/g, '<chart readonly="true"'))
    }
  }, [isEditable]);

  React.useEffect(() => {
    if (editor && !alongsideCritique) {
      let newContent = editor.getJSON()

      for(let i = 0; i < newContent.content.length; i++)
        newContent.content[i] = removeTempHighlight(newContent.content[i])
     
      editor.commands.setContent(newContent)
    }
  }, [alongsideCritique])

  return (
    <>
      {!alongsideCritique &&
        <BubbleMenu editor={editor} readOnly={!isEditable} setShowCritique={setShowCritique} />
      }

      <FloatingMenu
        editor={editor}
        tableConfig={tableConfig}
        modal={modal}
        setModal={setModal}
      />

      <ChartModal isOpen={modal} setIsOpen={setModal} editor={editor} />

      <EditorContent editor={editor} style={{ width: "100%" }} />
    </>
  )
}