import React from "react"
import { BubbleMenu } from "@tiptap/react"
import { isTextSelection } from '@tiptap/core';
import {
  PiListBulletsBold,
  PiListNumbersFill,
  PiQuotesFill
} from "react-icons/pi"

export default ({ editor, readOnly }) => {
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
            <button>criticar</button>
          </>
          :
          <>
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
          </>
        }
      </BubbleMenu>
    </div>
  )
}