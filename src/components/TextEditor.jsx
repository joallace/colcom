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
import ModalChart from "@/components/Chart"
import Modal from "@/components/Modal"
import Input from "@/components/Input"

import { chartData } from "@/assets/mock_data"


const CustomDocument = Document.extend({
  content: "heading block*",
})

export default ({ setContent = () => { }, tableConfig = { maxRows: 100, maxColumns: 50 }, ...remainingProps }) => {
  const [isMenuInput, setIsMenuInput] = React.useState(false)
  const [modal, setModal] = React.useState(false)
  const [numberRows, setNumberRows] = React.useState(0)
  const [numberColumns, setNumberColumns] = React.useState(0)
  const [chartType, setChartType] = React.useState("line")

  const editor = useEditor({
    extensions: [
      CustomDocument,
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
        levels: [1, 2, 3],
      }),
      Placeholder.configure({
        placeholder: "Qual é o título?"
      })
    ],
    editorProps: {
      handleDOMEvents: {
        drop: (_, e) => { e.preventDefault(); },
      }
    },
    onUpdate: ({ editor }) => {
      setContent(editor.getHTML())
    },
    onTransaction: () => {
      if (isMenuInput) {
        setNumberRows(0)
        setNumberColumns(0)
        setIsMenuInput(false)
      }
    },
    content: `
    <p>
      This is still the text editor you’re used to, but enriched with node views.
    </p>
    <chart data="${JSON.stringify(chartData).replace(/\"/g, "'")}"></chart>
    <p>
      Did you see that? That’s a React component. We are really living in the future.
    </p>
    `
  })

  const validateTableInterval = () => (numberColumns >= 1 && numberColumns <= tableConfig.maxColumns && numberRows >= 2 && numberRows <= tableConfig.maxRows)

  const insertTable = () => { validateTableInterval() && editor.chain().focus().insertTable({ rows: +numberRows + 1, cols: numberColumns, withHeaderRow: true }).run() }
  return (
    <>
      {(editor && !editor.isActive("heading", { level: 1 }) && !editor.isActive("table")) &&
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

      {(editor && !editor.isActive("heading", { level: 1 })) &&
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
                  // onClick={() => editor.chain().focus().insertContent(`<chart data="${JSON.stringify(chartData).replace(/\"/g, "'")}"/>`).run()}
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

      <Modal
        isOpen={true}
        setIsOpen={setModal}
        title="insira um gráfico"
        footer={[<button>salvar</button>]}
      >
        <div className="body">
          <div className="left">
            <Input
              label="tipo de gráfico"
              id="typeInput"
              type="select"
              options={{
                "linha": "line",
                "área": "area",
                "barra": "bar",
                "pizza": "pie",
                "pontos": "scatter",
                "radar": "radar"
              }}
              onChange={e => { setChartType(e.target.value) }}
              value={chartType}
            />

            <div className="bottom">
              <Input
                id="colInput"
                label="n.º de colunas"
                placeholder="n.º de colunas"
                value={numberColumns ? numberColumns : ""}
                onChange={e => { e.target.value >= 0 && setNumberColumns(e.target.value.replace(/\D/, "")) }}
              />
              <Input
                id="rowInput"
                label="n.º de linhas"
                placeholder="n.º de linhas"
                value={numberRows ? numberRows : ""}
                  onChange={e => { e.target.value >= 0 && setNumberRows(e.target.value.replace(/\D/, "")) }}
              />
            </div>
          </div>
          <ModalChart className="right" type={chartType} width={200} height={200} />
        </div>

      </Modal >

      <div className="text-editor" {...remainingProps}>
        <div className="bracket" />
        <EditorContent editor={editor} style={{ width: "100%" }} />
      </div>
    </>
  )
}