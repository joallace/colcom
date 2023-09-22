import {
  BubbleMenu,
  EditorContent,
  FloatingMenu,
  useEditor,
} from '@tiptap/react'
import {PiListBulletsBold} from "react-icons/pi"
import Document from '@tiptap/extension-document'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import React from 'react'

const CustomDocument = Document.extend({
  content: 'heading block*',
})

export default () => {
  const editor = useEditor({
    extensions: [
      CustomDocument,
      StarterKit.configure({
        document: false,
      }),
      Placeholder.configure({
        placeholder: 'Qual é o título?'
      })
    ],
    content: ""
  })

  return (
    <>
      {editor &&
        <div>
          <BubbleMenu
            className="bubble-menu"
            tippyOptions={{ duration: 100 }}
            editor={editor}
          >
            <button
              onClick={() => editor.chain().focus().toggleBold().run()}
              className={editor.isActive('bold') ? 'is-active' : ''}
            >
              Negrito
            </button>
            <button
              onClick={() => editor.chain().focus().toggleItalic().run()}
              className={editor.isActive('italic') ? 'is-active' : ''}
            >
              Itálico
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
            >
              H1
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
            >
              H2
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={editor.isActive('bulletList') ? 'is-active' : ''}
            >
              Bullet List
            </button>
          </BubbleMenu>
        </div>
      }

      {(editor && !editor.isEmpty) &&
        <div>
          <FloatingMenu
            className="floating-menu"
            tippyOptions={{ duration: 100 }}
            editor={editor}
          >
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
              className={editor.isActive('heading', { level: 1 }) ? 'is-active' : ''}
            >
              H1
            </button>
            <button
              onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
              className={editor.isActive('heading', { level: 2 }) ? 'is-active' : ''}
            >
              H2
            </button>
            <button
              onClick={() => editor.chain().focus().toggleBulletList().run()}
              className={editor.isActive('bulletList') ? 'is-active' : ''}
            >
              Bullet List
            </button>
          </FloatingMenu>
        </div>
      }

      <div className="text-editor">
        <div className="bracket" />
        <EditorContent editor={editor} style={{ width: "100%" }} />
      </div>
    </>
  )
}