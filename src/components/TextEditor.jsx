import React from "react"

import {
  EditorContent,
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

import {
  PiBookmarkSimpleBold,
  PiBookmarkSimpleFill,
  PiArrowBendUpLeftBold,
  PiDotsThreeVerticalBold
} from "react-icons/pi"

import useScreenSize from "@/hooks/useScreenSize"
import Chart from "@/components/TipTapChart"
import ChartModal from "@/components/ChartModal"
import BubbleMenu from "@/components/BubbleMenu"
import FloatingMenu from "@/components/FloatingMenu"
import { ChartContext } from "@/context/ChartContext"


export default ({ title, setTitle, content, setContent = () => { }, tableConfig = { maxRows: 20, maxColumns: 10 }, readOnly = false, ...remainingProps }) => {
  const [modal, setModal] = React.useState(false)
  const [isBookmarked, setBookmark] = React.useState(false)
  const { chartString, resetChartStr } = React.useContext(ChartContext)
  const titleRef = React.useRef()
  const isDesktop = useScreenSize()
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
    editable: !readOnly,
    content: readOnly ? content.replace(/<chart readonly="false"/g, '<chart readonly="true"') : content,
  })

  const bookmarkClick = () => { setBookmark(!isBookmarked) }

  // If there is a change in the chartData string, it is an edition of a chart by the modal.
  // So we need to delete the old chart and insert the new string
  React.useEffect(() => {
    if (chartString.length !== 0) {
      editor.commands.deleteNode('chart')
      editor.chain().focus().insertContent(chartString).run()
      resetChartStr()
    }
  }, [chartString])

  // Updating the title input height accordingly with the title
  React.useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = '32px';
      titleRef.current.style.height = `${titleRef.current.scrollHeight + 2}px`;
    }
  }, [title]);

  return (
    <>
      <BubbleMenu editor={editor} readOnly={readOnly} />

      <FloatingMenu
        editor={editor}
        tableConfig={tableConfig}
        modal={modal}
        setModal={setModal}
      />

      <ChartModal isOpen={modal} setIsOpen={setModal} editor={editor} />

      <div className={`text-editor${readOnly? " topic" : ""}`} {...remainingProps}>
        <div className="bracket" />
        <div className="text">
          <div className="header">
            <h1 className="title">
              {readOnly ?
                title
                :
                <textarea
                  placeholder="Qual é o título?"
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { editor.chain().focus().run(); e.preventDefault() } }}
                  onBlur={_ => localStorage.setItem("postTitle", title)}
                  ref={titleRef}
                />
              }
            </h1>
            { readOnly && 
              <div className="right-side">
                {isDesktop ?
                  <>
                    <PiArrowBendUpLeftBold title="Responder tópico" className="icons" />
                    {isBookmarked ?
                      <PiBookmarkSimpleFill title="Remover tópico dos salvos" className="icons" onClick={bookmarkClick} />
                      :
                      <PiBookmarkSimpleBold title="Salvar tópico" className="icons" onClick={bookmarkClick} />
                    }
                  </>
                  :
                  <PiDotsThreeVerticalBold className="icons" />
                }
              </div>
            }
          </div>
          <EditorContent editor={editor} style={{ width: "100%" }} />
        </div>
      </div>
    </>
  )
}