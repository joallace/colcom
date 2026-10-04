import React from "react"

import {
  EditorContent,
  useEditor,
} from "@tiptap/react"

import getExtensions from "@/components/Editor/extensions"
import ChartModal from "@/components/Editor/ChartModal"
import BubbleMenu from "@/components/Editor/BubbleMenu"
import FloatingMenu from "@/components/Editor/FloatingMenu"
import { ChartContext } from "@/context/ChartContext"


export default function Editor({
  content,
  setContent = () => { },
  critiques = [],
  groupedCritiques = [],
  reset,
  initialContent,
  saveInLocalStorage = false,
  readOnly = true,
  edit: isEditable = !readOnly,
  alongsideCritique,
  setShowCritique,
  critiquesVisible,
  tableConfig = { maxRows: 20, maxColumns: 10 },
  bubbleMenuShouldShow = true,
  tempHighlight = [],
  // The version this content is compared against, its changes highlighted (reviewing a suggestion)
  diffBase,
  ...remainingProps
}) {
  const [markedBody, setMarkedBody] = React.useState()
  const [modal, setModal] = React.useState(false)
  const { chartString, resetChartStr } = React.useContext(ChartContext)

  const injectCritiques = ({ editor }) => {
    groupedCritiques.forEach((critique) => {
      editor.chain().setTextSelection(critique).setHighlight({ type: critique.type ?? "definitive", index: critique.index.length > 1 ? JSON.stringify(critique.index) : critique.index }).run()
    })

    editor.chain().setTextSelection(0).blur().run()
    setMarkedBody(editor.getHTML())
  }

  // TipTap compares extensions by identity on every render, and new instances make it reconfigure
  // the editor, which re-renders this component again. Built once, they stay identical.
  const extensions = React.useMemo(() => getExtensions({ setShowCritique }), [setShowCritique])

  const editor = useEditor({
    extensions,
    // Creating the editor after mounting, rather than while rendering, lets the React node views
    // (charts) render without forcing a synchronous flush in the middle of a render
    immediatelyRender: false,
    editorProps: {
      handleDOMEvents: {
        drop: (_, e) => { e.preventDefault(); },
      }
    },
    onBlur: ({ editor }) => {
      const editorContent = editor.getHTML()

      setContent(editorContent)

      if (saveInLocalStorage)
        localStorage.setItem("editorContent", editorContent)
    },
    onCreate: injectCritiques,
    editable: isEditable,
    content: isEditable ? content : content?.replace(/<chart readonly="false"/g, '<chart readonly="true"')
  })

  const removeTempHighlight = obj => {
    if (obj.marks)
      for (let i = 0; i < obj.marks.length; i++)
        if (obj.marks[i].type === "highlight" && obj.marks[i].attrs.type === "temporary")
          obj.marks.splice(i, 1)

    if (obj.content)
      for (let i = 0; i < obj.content.length; i++)
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
    if (tempHighlight.length === 2)
      editor.chain().setContent(markedBody).setTextSelection({ from: tempHighlight[0], to: tempHighlight[1] }).setHighlight({ type: "temporary" }).run()
  }, [tempHighlight])

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
    if (editor) {
      if (critiquesVisible)
        editor.commands.setContent(markedBody)
      else
        editor.commands.setContent(initialContent)
    }
  }, [critiquesVisible])

  React.useEffect(() => {
    if (editor && !alongsideCritique) {
      injectCritiques({ editor })
      let newContent = editor.getJSON()

      for (let i = 0; i < newContent.content.length; i++)
        newContent.content[i] = removeTempHighlight(newContent.content[i])

      setMarkedBody(newContent)

      if (!critiquesVisible)
        editor.commands.setContent(initialContent)
      else
        editor.commands.setContent(newContent)
    }
  }, [alongsideCritique])

  React.useEffect(() => {
    editor?.commands.setContent(initialContent)
  }, [reset])

  React.useEffect(() => {
    if (!editor || editor.isDestroyed)
      return

    editor.commands.setDiffBase(diffBase ?? null)
  }, [editor, diffBase])

  return (
    <>
      {!alongsideCritique &&
        <BubbleMenu editor={editor} readOnly={!isEditable} setShowCritique={setShowCritique} shouldShow={bubbleMenuShouldShow} />
      }

      <FloatingMenu
        editor={editor}
        tableConfig={tableConfig}
        modal={modal}
        setModal={setModal}
      />

      <ChartModal isOpen={modal} setIsOpen={setModal} editor={editor} />

      {diffBase &&
        <div className="diffLegend">
          comparando com a versão em que a sugestão foi feita:
          <span className="diffInsert">adicionado</span>
          <span className="diffDelete">removido</span>
        </div>
      }

      <EditorContent editor={editor} style={{ width: "100%" }} />
    </>
  )
}