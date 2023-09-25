import React from "react"
import {
  PiListBulletsBold,
  PiListNumbersFill,
  PiPresentationChartFill,
  PiTableFill
} from "react-icons/pi"

import {
  BubbleMenu,
  EditorContent,
  FloatingMenu,
  useEditor,
} from "@tiptap/react"
import Document from "@tiptap/extension-document"
import Heading from "@tiptap/extension-heading"
import Placeholder from "@tiptap/extension-placeholder"
import StarterKit from "@tiptap/starter-kit"


const CustomDocument = Document.extend({
  content: "heading block*",
})

export default ({setContent = ()=>{}}, ...remainingProps) => {
  const editor = useEditor({
    extensions: [
      CustomDocument,
      StarterKit.configure({
        document: false,
      }),
      Heading.configure({
        levels: [1, 2],
      }),
      Placeholder.configure({
        placeholder: "Qual é o título?"
      })
    ],
    onUpdate: ({editor})=>{setContent(editor.getHTML())}
  })

  return (
    <>
      {(editor && !editor.isActive("heading", { level: 1 })) &&
        <div>
          <BubbleMenu
            className="menu"
            tippyOptions={{ duration: 100 }}
            editor={editor}
          >
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={editor.isActive("bold") ? "bold is-active" : "bold"}
            >
              Negrito
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={editor.isActive("italic") ? "italic is-active" : "italic"}
            >
              Itálico
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={editor.isActive("heading", { level: 2 }) ? "is-active" : ""}
            >
              Cabeçalho
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={editor.isActive("bulletList") ? "icon is-active" : "icon"}
            >
              <PiListBulletsBold title="Tópicos sem ordem" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={editor.isActive("orderedList") ? "icon is-active" : "icon"}
            >
              <PiListNumbersFill title="Tópicos ordenados" />
            </button>
          </BubbleMenu>
        </div>
      }

      {(editor && !editor.isActive("heading", { level: 1 })) &&
        <div>
          <FloatingMenu
            className="menu"
            tippyOptions={{ duration: 100 }}
            editor={editor}
          >
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={editor.isActive("heading", { level: 2 }) ? "is-active" : ""}
            >
              Cabeçalho
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={editor.isActive("bulletList") ? "icon is-active" : "icon"}
            >
              <PiListBulletsBold title="Tópicos sem ordem" />
            </button>
            <button
              onClick={() => editor.chain().focus().toggleOrderedList().run()}
              className={editor.isActive("orderedList") ? "icon is-active" : "icon"}
            >
              <PiListNumbersFill title="Tópicos ordenados" />
            </button>
            <button
              onClick={() => {}}
              className={editor.isActive("orderedList") ? "icon is-active" : "icon"}
            >
              <PiPresentationChartFill title="Inserir gráfico" />
            </button>
            <button
              onClick={() => {}}
              className={editor.isActive("orderedList") ? "icon is-active" : "icon"}
            >
              <PiTableFill title="Inserir tabela" />
            </button>
          </FloatingMenu>
        </div>
      }

      <div className="text-editor" {...remainingProps}>
        <div className="bracket" />
        <EditorContent editor={editor} style={{ width: "100%" }} />
      </div>
    </>
  )
}