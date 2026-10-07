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
import { CRITIQUE_LEVELS } from "@/assets/critiqueDensity"


export default function Editor({
  content,
  setContent = () => { },
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
  diffBase
}) {
  // The content with the critiques highlighted; only effects read it, so changing it needn't re-render
  const markedBody = React.useRef()
  // TipTap emits "create" a tick after the editor exists, so for a moment it's there without the
  // critiques marked: a highlight asked for then (a version loaded with a critique's passage
  // still marked) would rebuild it from no content, and its range wouldn't fit the empty document
  const [isMarked, setIsMarked] = React.useState(false)
  const [modal, setModal] = React.useState(false)
  const { chartString, resetChartStr } = React.useContext(ChartContext)

  const injectCritiques = ({ editor }) => {
    groupedCritiques.forEach(({ segments }) => {
      // Every segment opens the whole group, starting with the critiques covering it
      segments.forEach(({ from, to, type, level, index }) => {
        editor.commands.highlightRange({ from, to }, { type, index: index.length > 1 ? JSON.stringify(index) : index[0], level })
      })
    })

    editor.chain().setTextSelection(0).blur().run()
    markedBody.current = editor.getHTML()
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
    onCreate: props => {
      injectCritiques(props)
      setIsMarked(true)
    },
    editable: isEditable,
    content: isEditable ? content : content?.replace(/<chart readonly="false"/g, '<chart readonly="true"')
  })

  const removeTempHighlight = obj => {
    // A chart carries its highlight as attributes, since marks only cover text
    if (obj.type === "chart" && obj.attrs?.highlight === "temporary")
      obj.attrs = { ...obj.attrs, highlight: null, highlightIndex: null, highlightLevel: null }

    if (obj.marks)
      for (let i = 0; i < obj.marks.length; i++)
        if (obj.marks[i].type === "highlight" && obj.marks[i].attrs.type === "temporary")
          obj.marks.splice(i, 1)

    if (obj.content)
      for (let i = 0; i < obj.content.length; i++)
        obj.content[i] = removeTempHighlight(obj.content[i])

    return obj
  }

  // Each effect below runs only when its trigger changes; the effect events it calls read the
  // latest editor and props without becoming triggers themselves.

  // If there is a change in the chartData string, it is an edition of a chart by the modal.
  // So we need to delete the old chart and insert the new string
  const replaceChart = React.useEffectEvent(() => {
    editor.commands.deleteNode('chart')
    editor.chain().focus().insertContent(chartString).run()
    resetChartStr()
  })

  React.useEffect(() => {
    if (chartString.length !== 0)
      replaceChart()
  }, [chartString])

  const showTempHighlight = React.useEffectEvent(() => {
    editor.chain().setContent(markedBody.current).highlightRange({ from: tempHighlight[0], to: tempHighlight[1] }, { type: "temporary" }).run()
  })

  React.useEffect(() => {
    if (isMarked && tempHighlight.length === 2)
      showTempHighlight()
  // A highlight asked for before the critiques are marked is shown once they are
  }, [isMarked, tempHighlight])

  const applyEditable = React.useEffectEvent(() => {
    if (editor) {
      editor.setEditable(isEditable)

      if (isEditable)
        editor.commands.setContent(editor.getHTML().replace(/<chart readonly="true"/g, '<chart readonly="false"'))
      else
        editor.commands.setContent(editor.getHTML().replace(/<chart readonly="false"/g, '<chart readonly="true"'))
    }
  })

  React.useEffect(() => {
    applyEditable()
  }, [isEditable])

  const applyCritiquesVisible = React.useEffectEvent(() => {
    if (editor) {
      if (critiquesVisible)
        editor.commands.setContent(markedBody.current)
      else
        editor.commands.setContent(initialContent)
    }
  })

  React.useEffect(() => {
    applyCritiquesVisible()
  }, [critiquesVisible])

  const remarkCritiques = React.useEffectEvent(() => {
    if (editor && !alongsideCritique) {
      injectCritiques({ editor })
      let newContent = editor.getJSON()

      for (let i = 0; i < newContent.content.length; i++)
        newContent.content[i] = removeTempHighlight(newContent.content[i])

      markedBody.current = newContent

      if (!critiquesVisible)
        editor.commands.setContent(initialContent)
      else
        editor.commands.setContent(newContent)
    }
  })

  React.useEffect(() => {
    remarkCritiques()
  }, [alongsideCritique])

  const resetContent = React.useEffectEvent(() => {
    editor?.commands.setContent(initialContent)
  })

  React.useEffect(() => {
    resetContent()
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

      {critiquesVisible && !isEditable && groupedCritiques.some(({ segments }) => segments.some(({ level }) => level > 1)) &&
        <div className="critiqueLegend">
          críticas por trecho:
          {CRITIQUE_LEVELS.map((label, i) => <span key={label} data-level={i + 1}>{label}</span>)}
        </div>
      }

      <EditorContent editor={editor} style={{ width: "100%" }} />
    </>
  )
}