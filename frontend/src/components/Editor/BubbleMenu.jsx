import React from "react"
import { BubbleMenu } from "@tiptap/react/menus"
import { isTextSelection } from '@tiptap/core'
import {
  PiListBulletsBold,
  PiListNumbersBold,
  PiQuotesFill
} from "react-icons/pi"

import useUser from "@/context/UserContext"
import useActiveFormats from "@/components/Editor/useActiveFormats"
import useToLogin from "@/hooks/useToLogin"


const hasTextSelection = ({ state, from, to }) =>
  !state.selection.empty && !(isTextSelection(state.selection) && !state.doc.textBetween(from, to).length)

// TipTap's own rule for editable text: only while the editor, or the menu itself, has focus
const hasFocus = ({ view, element }) => view.hasFocus() || element.contains(document.activeElement)


export default function EditorBubbleMenu({ editor, shouldShow = true, readOnly, setShowCritique }) {
  // Hooks must run on every render, before the early return
  const toLogin = useToLogin()
  const { user } = useUser()
  const active = useActiveFormats(editor)

  // TipTap's bubble menu leaves timers running after it unmounts (its 250 ms update debounce,
  // focus and resize handlers). One firing later shows the menu's now empty element again, stuck
  // over the text where it was. Refusing to show once the menu is no longer rendered stops that.
  const isRendered = React.useRef(false)
  React.useLayoutEffect(() => {
    isRendered.current = Boolean(editor && shouldShow)
    return () => { isRendered.current = false }
  })

  if (!editor || !shouldShow)
    return

  return (
    <div>
      <BubbleMenu
        className={`menu editorMenu ${!readOnly && (active.chart || active.table) ? "hidden" : "bubble"}`}
        editor={editor}
        shouldShow={props => isRendered.current && hasTextSelection(props) && (readOnly || hasFocus(props))}
      >
        {readOnly ?
          <>
            <button
              onClick={() => {
                if (!user) {
                  toLogin()
                  return
                }
                // The selection may be a chart (a node selection), which a mark alone can't highlight
                const { from, to } = editor.state.selection
                editor.chain().focus().highlightRange({ from, to }, { type: "temporary" }).run()
                setShowCritique([from, to])
              }}
            >
              criticar
            </button>
          </>
          :
          <>
            <button
              className={active.bold ? "bold is-active" : "bold"}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              negrito
            </button>
            <button
              className={active.italic ? "italic is-active" : "italic"}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              itálico
            </button>
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
              onClick={() => {
                editor.isActive("blockquote") && editor.chain().focus().toggleBlockquote().run()
                editor.chain().focus().toggleBulletList().run()
              }}
            >
              <PiListBulletsBold title="tópicos sem ordem" />
            </button>
            <button
              className={active.orderedList ? "icon is-active" : "icon"}
              onClick={() => {
                editor.isActive("blockquote") && editor.chain().focus().toggleBlockquote().run()
                editor.chain().focus().toggleOrderedList().run()
              }}
            >
              <PiListNumbersBold title="tópicos ordenados" />
            </button>
            <button
              className={active.blockquote ? "icon is-active" : "icon"}
              onClick={() => {
                editor.isActive("bulletList") && editor.chain().focus().toggleBulletList().run()
                editor.isActive("orderedList") && editor.chain().focus().toggleOrderedList().run()
                editor.chain().focus().toggleBlockquote().run()
              }}
            >
              <PiQuotesFill title="citação" />
            </button>
          </>
        }
      </BubbleMenu>
    </div>
  )
}