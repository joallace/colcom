import React from "react"
import { Link } from "react-router-dom"
import {
  PiCaretUpBold,
  PiCaretDownBold,
  PiBookmarkSimple,
  PiBookmarkSimpleFill,
  PiArrowBendUpLeft,
  PiDotsThreeVerticalBold,
  PiPencilSimpleFill,
  PiPencilSimple,
  PiGitBranch
} from "react-icons/pi"

import useScreenSize from "@/hooks/useScreenSize"


export default function Topic({ title, setTitle, posts = [], icons = [], metrics = [], bookmarked = false, readOnly = true, hideVoteButtons = false, children, ...remainingProps }) {
  const [isBookmarked, setBookmark] = React.useState(bookmarked)
  const [isEditable, setEditable] = React.useState(!readOnly)
  const titleRef = React.useRef()
  const isDesktop = useScreenSize()

  const toggle = (setter) => _ => { setter(prev => !prev) }

  React.useEffect(() => {
    if (titleRef.current) {
      titleRef.current.style.height = '32px';
      titleRef.current.style.height = `${titleRef.current.scrollHeight + 2}px`;
    }
  }, [title]);

  return (
    <div className="topic" {...remainingProps}>
      <div className="bracket" />
      <div className="body">
        <div className="header">
          <div className="left-side">
            {!hideVoteButtons &&
              <div className="vote-buttons">
                <PiCaretUpBold title="relevante" className="up" />
                <PiCaretDownBold title="não relevante" className="down" />
              </div>
            }
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
          </div>
          <div className="right-side">
            {readOnly &&
              (
                isDesktop ?
                  <>
                    <PiArrowBendUpLeft title="responder tópico" className="icons" />
                    <PiGitBranch title="clonar tópico" className="icons" />
                    {isEditable ?
                      <PiPencilSimpleFill title="editar tópico" className="icons" onClick={toggle(setEditable)} />
                      :
                      <PiPencilSimple title="editar tópico" className="icons" onClick={toggle(setEditable)} />
                    }
                    {isBookmarked ?
                      <PiBookmarkSimpleFill title="remover tópico dos salvos" className="icons" onClick={toggle(setBookmark)} />
                      :
                      <PiBookmarkSimple title="salvar tópico" className="icons" onClick={toggle(setBookmark)} />
                    }
                  </>
                  :
                  <PiDotsThreeVerticalBold className="icons" />
              )
            }
          </div>
        </div>
        {children ?
          React.cloneElement(children, { isEditable })
          :
          posts.length > 0 ?
            posts.map((post, index) => {
              return (
                <div>
                  <div className="post-percentage-bar" style={{ width: `${post.percentage}%` }}>
                    <span>{post.shortAnswer ? post.shortAnswer : `${index + 1}.`}</span>
                    <span>{`${post.percentage}%`}</span>
                  </div>
                  {post.summary}
                  <Link className="unselectable read-more" to={`/post/${post.id}`}>continuar...</Link>
                </div>
              )
            })
            :
            <div className="no-response">
              Ainda não há repostas, que tal contribuir?
            </div>
        }
        <ul className="metrics">
          <li>Promovido por 40 usuários</li>
          <li>80% dos 135 votantes achou relevante</li>
          <li>4200 interações</li>
        </ul>
      </div>
    </div>
  )
}