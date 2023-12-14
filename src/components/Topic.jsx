import React from "react"
import { Link } from "react-router-dom"
import {
  PiCaretUpBold,
  PiCaretDownBold,
  PiBookmarkSimpleBold,
  PiBookmarkSimpleFill,
  PiArrowBendUpLeftBold,
  PiDotsThreeVerticalBold
} from "react-icons/pi"

import useScreenSize from "@/hooks/useScreenSize"


export default function Topic({ title, posts = [], icons = [], metrics = [], bookmarked = false, ...remainingProps }) {
  const [isBookmarked, setBookmark] = React.useState(bookmarked)
  const isDesktop = useScreenSize()

  const bookmarkClick = () => { setBookmark(!isBookmarked) }

  return (
    <div className="topic" {...remainingProps}>
      <div className="bracket" />
      <div className="body">
        <div className="header">
          <div className="left-side">
            <div className="vote-buttons">
              <PiCaretUpBold title="Relevante" className="up" />
              <PiCaretDownBold title="Não relevante" className="down" />
            </div>
            <h2 className="title" title="Ver todas as respostas">{title}</h2>
          </div>
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
              <PiDotsThreeVerticalBold className="icons"/>
            }
          </div>
        </div>
        {posts.length > 0 ?
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