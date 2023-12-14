import React from "react"
import {
  PiListBulletsBold,
  PiListNumbersFill,
  PiPresentationChartFill,
  PiTableFill,
  PiQuotesFill
} from "react-icons/pi"

import {
  BubbleMenu,
  EditorContent,
  FloatingMenu,
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

import Chart from "@/components/TipTapChart"
import ChartModal from "@/components/ChartModal"


export default ({ title, setTitle, content, setContent = () => { }, tableConfig = { maxRows: 20, maxColumns: 10 }, ...remainingProps }) => {
  const [isMenuInput, setIsMenuInput] = React.useState(false)
  const [modal, setModal] = React.useState(false)
  const [numberRows, setNumberRows] = React.useState(0)
  const [numberColumns, setNumberColumns] = React.useState(0)
  const [chartData, setChartData] = React.useState([])
  const titleRef = React.useRef()

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
      const editorContent = editor.getHTML()
      setContent(editorContent)
      localStorage.setItem("editorContent", editorContent)
    },
    onTransaction: () => {
      if (isMenuInput) {
        setNumberRows(0)
        setNumberColumns(0)
        setIsMenuInput(false)
      }
    },
    content
  })

  const validateTableInterval = () => (numberColumns >= 1 && numberColumns <= tableConfig.maxColumns && numberRows >= 2 && numberRows <= tableConfig.maxRows)

  const insertTable = () => { validateTableInterval() && editor.chain().focus().insertTable({ rows: +numberRows + 1, cols: numberColumns, withHeaderRow: true }).run() }

  // If there is a change in the chartData string, it is an insertion of a chart
  React.useEffect(() => {
    if (chartData.length !== 0)
      editor.chain().focus().insertContent(chartData).run()
  }, [chartData])

  // Updating the title input height accordingly with the title
  React.useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = '32px';
      titleRef.current.style.height = `${titleRef.current.scrollHeight + 2}px`;
    }
  }, [title]);

  return (
    <>
      {(editor && !editor.isEmpty && !editor.isActive("table")) &&
        <div>
          <BubbleMenu
            className={`menu ${editor.isActive("chart") ? "hidden" : "bubble"}`}
            tippyOptions={{ duration: 100 }}
            editor={editor}
          >
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={editor.isActive("bold") ? "bold is-active" : "bold"}
            >
              negrito
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={editor.isActive("italic") ? "italic is-active" : "italic"}
            >
              itálico
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={editor.isActive("heading", { level: 2 }) ? "h1 is-active" : "h1"}
            >
              cabeçalho 1
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
              className={editor.isActive("heading", { level: 3 }) ? "h2 is-active" : "h2"}
            >
              cabeçalho 2
            </button>
            <button
              onClick={() => {
                editor.isActive("blockquote") && editor.chain().focus().toggleBlockquote().run()
                editor.chain().focus().toggleBulletList().run()
              }}
              className={editor.isActive("bulletList") ? "icon is-active" : "icon"}
            >
              <PiListBulletsBold title="tópicos sem ordem" />
            </button>
            <button
              onClick={() => {
                editor.isActive("blockquote") && editor.chain().focus().toggleBlockquote().run()
                editor.chain().focus().toggleOrderedList().run()
              }}
              className={editor.isActive("orderedList") ? "icon is-active" : "icon"}
            >
              <PiListNumbersFill title="tópicos ordenados" />
            </button>
            <button
              onClick={() => {
                editor.isActive("bulletList") && editor.chain().focus().toggleBulletList().run()
                editor.isActive("orderedList") && editor.chain().focus().toggleOrderedList().run()
                editor.chain().focus().toggleBlockquote().run()
              }}
              className={editor.isActive("blockquote") ? "icon is-active" : "icon"}
            >
              <PiQuotesFill title="citação" />
            </button>
          </BubbleMenu>
        </div>
      }

      {(editor && !editor.isEmpty) &&
        <div>
          <FloatingMenu
            className={`menu ${modal && "hidden"}`}
            tippyOptions={{ duration: 100 }}
            editor={editor}
          >
            {isMenuInput ?
              <>
                <input
                  placeholder="n.º de colunas"
                  value={numberColumns ? numberColumns : ""}
                  onChange={e => { e.target.value >= 0 && setNumberColumns(e.target.value.replace(/\D/, "")) }}
                  onKeyDown={e => { e.key === "Enter" && insertTable() }}
                />
                <input
                  placeholder="n.º de linhas"
                  value={numberRows ? numberRows : ""}
                  onChange={e => { e.target.value >= 0 && setNumberRows(e.target.value.replace(/\D/, "")) }}
                  onKeyDown={e => { e.key === "Enter" && insertTable() }}
                />
              </>
              :
              <>
                <button
                  onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
                  className={editor.isActive("heading", { level: 2 }) ? "h1 is-active" : "h1"}
                >
                  cabeçalho 1
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
                  className={editor.isActive("heading", { level: 3 }) ? "h2 is-active" : "h2"}
                >
                  cabeçalho 2
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleBulletList().run()}
                  className={editor.isActive("bulletList") ? "icon is-active" : "icon"}
                >
                  <PiListBulletsBold title="inserir tópicos sem ordem" />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleOrderedList().run()}
                  className={editor.isActive("orderedList") ? "icon is-active" : "icon"}
                >
                  <PiListNumbersFill title="inserir tópicos ordenados" />
                </button>
                <button
                  onClick={() => editor.chain().focus().toggleBlockquote().run()}
                  className={editor.isActive("blockquote") ? "icon is-active" : "icon"}
                >
                  <PiQuotesFill title="inserir citação" />
                </button>
                <button
                  onClick={() => setModal(true)}
                  className="icon"
                >
                  <PiPresentationChartFill title="inserir gráfico" />
                </button>
                <button
                  onClick={() => setIsMenuInput(true)}
                  className="icon"
                >
                  <PiTableFill title="inserir tabela" />
                </button>
              </>
            }
          </FloatingMenu>
        </div>
      }

      {modal &&
        <ChartModal isOpen={modal} setIsOpen={setModal} setChartOutput={setChartData} />
      }

      <div className="text-editor" {...remainingProps}>
        <div className="bracket" />
        <div className="text">
          <h1 className="title">
            <textarea
              placeholder="Qual é o título?"
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => {if(e.key === "Enter"){editor.chain().focus().run(); e.preventDefault()}}}
              onBlur={_ => localStorage.setItem("postTitle", title)}
              ref={titleRef}
            />
          </h1>
          <EditorContent editor={editor} style={{ width: "100%" }} />
        </div>
      </div>
    </>
  )
}