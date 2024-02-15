import React from "react"
import { BubbleMenu } from "@tiptap/react"
import { isTextSelection } from '@tiptap/core';
import {
  PiListBulletsBold,
  PiListNumbersFill,
  PiQuotesFill
} from "react-icons/pi"

import { highlightYellow } from "@/assets/scss/_export.module.scss"

export default ({ editor, readOnly, setShowCritique }) => {
  if (!editor)
    return

  return (
    <div>
      <BubbleMenu
        className={`menu ${!readOnly && (editor.isActive("chart") || editor.isActive("table")) ? "hidden" : "bubble"}`}
        tippyOptions={{ duration: 10 }}
        editor={editor}
        shouldShow={readOnly ?
          ({ state, from, to }) => {
            const { doc, selection } = state;
            const { empty } = selection;
            const isEmptyTextBlock = !doc.textBetween(from, to).length && isTextSelection(state.selection);
            if (empty || isEmptyTextBlock)
              return false;
            return true;
          }
          :
          null
        }
      >
        {readOnly ?
          <>
            <button
              onClick={() => {
                editor.chain().focus().toggleHighlight({ color: "#8e390c", type: "temporary" }).run()
                setShowCritique([editor.view.state.selection.ranges[0]["$from"].pos, editor.view.state.selection.ranges[0]["$to"].pos])
              }}
            >
              criticar
            </button>
          </>
          :
          <>
            <button
              className={editor.isActive("bold") ? "bold is-active" : "bold"}
              onClick={() => editor.chain().focus().toggleBold().run()}
            >
              negrito
            </button>
            <button
              className={editor.isActive("italic") ? "italic is-active" : "italic"}
              onClick={() => editor.chain().focus().toggleItalic().run()}
            >
              itálico
            </button>
            <button
              className={editor.isActive("heading", { level: 2 }) ? "h1 is-active" : "h1"}
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
            >
              cabeçalho 1
            </button>
            <button
              className={editor.isActive("heading", { level: 3 }) ? "h2 is-active" : "h2"}
              onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
            >
              cabeçalho 2
            </button>
            <button
              className={editor.isActive("bulletList") ? "icon is-active" : "icon"}
              onClick={() => {
                editor.isActive("blockquote") && editor.chain().focus().toggleBlockquote().run()
                editor.chain().focus().toggleBulletList().run()
              }}
            >
              <PiListBulletsBold title="tópicos sem ordem" />
            </button>
            <button
              className={editor.isActive("orderedList") ? "icon is-active" : "icon"}
              onClick={() => {
                editor.isActive("blockquote") && editor.chain().focus().toggleBlockquote().run()
                editor.chain().focus().toggleOrderedList().run()
              }}
            >
              <PiListNumbersFill title="tópicos ordenados" />
            </button>
            <button
              className={editor.isActive("blockquote") ? "icon is-active" : "icon"}
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