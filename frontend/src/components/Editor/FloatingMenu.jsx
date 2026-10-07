import React from "react"
import { FloatingMenu } from "@tiptap/react/menus"
import {
  PiListBulletsBold,
  PiListNumbersBold,
  PiPresentationChartFill,
  PiTableFill,
  PiQuotesFill
} from "react-icons/pi"

import useActiveFormats from "@/components/Editor/useActiveFormats"


export default function EditorFloatingMenu({ editor, tableConfig, modal, setModal }) {
  const [numberRows, setNumberRows] = React.useState(0)
  const [numberColumns, setNumberColumns] = React.useState(0)
  const [isTableInput, setIsTableInput] = React.useState(false)
  const [visible, setVisible] = React.useState(false) // This state is only to prevent the menu from showing while changing from tableInput to normal
  const active = useActiveFormats(editor)
  

  const validateTableInterval = () => (numberColumns >= 1 && numberColumns <= tableConfig.maxColumns && numberRows >= 2 && numberRows <= tableConfig.maxRows)

  const insertTable = () => { validateTableInterval() && editor.chain().focus().insertTable({ rows: +numberRows + 1, cols: numberColumns, withHeaderRow: true }).run() }

  if (!editor || active.isEmpty)
    return

  return (
    <div>
      <FloatingMenu
        className={`menu editorMenu${(modal || !visible) ? " hidden" : ""}`}
        editor={editor}
        shouldShow={({ view, state }) => {
          const { selection } = state;
          const { $anchor, empty } = selection;
          const isRootDepth = $anchor.depth === 1;
          const isEmptyTextBlock = $anchor.parent.isTextblock && !$anchor.parent.type.spec.code && !$anchor.parent.textContent;
          if (!view.hasFocus() || !empty || !isRootDepth || !isEmptyTextBlock) {
            setNumberRows(0) 
            setNumberColumns(0)
            setIsTableInput(false)
            setVisible(false)
            return false;
          }
          setVisible(true)
          return true;
      }}
      >
        {isTableInput ?
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
            <span>{`(máximo: ${tableConfig.maxColumns} e ${tableConfig.maxRows})`}</span>
          </>
          :
          <>
            <button
              className={active.heading2 ? "h1 is-active" : "h1"}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              cabeçalho 1
            </button>
            <button
              className={active.heading3 ? "h2 is-active" : "h2"}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            >
              cabeçalho 2
            </button>
            <button
              className={active.bulletList ? "icon is-active" : "icon"}
              onClick={() => editor.chain().focus().toggleBulletList().run()}
            >
              <PiListBulletsBold title="inserir tópicos sem ordem" />
            </button>
            <button
              className={active.orderedList ? "icon is-active" : "icon"}
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
            >
              <PiListNumbersBold title="inserir tópicos ordenados" />
            </button>
            <button
              className={active.blockquote ? "icon is-active" : "icon"}
              onClick={() => editor.chain().focus().toggleBlockquote().run()}
            >
              <PiQuotesFill title="inserir citação" />
            </button>
            <button
              className="icon"
              onClick={() => setModal(true)}
            >
              <PiPresentationChartFill title="inserir gráfico" />
            </button>
            <button
              className="icon"
              onClick={() => setIsTableInput(true)}
            >
              <PiTableFill title="inserir tabela" />
            </button>
          </>
        }
      </FloatingMenu>
    </div>
  )
}