import React from "react"
import { PiCaretUpBold, PiCaretDownBold, PiBookmarkSimpleBold, PiBookmarkSimpleFill } from "react-icons/pi"

export default function Topic({ title, posts = [], metrics, bookmarked = true, ...remainingProps }) {
  const [isBookmarked, setBookmark] = React.useState(bookmarked)

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
            <h2 className="title">{title}</h2>
          </div>
          {isBookmarked ?
            <PiBookmarkSimpleBold title="Salvar tópico" className="icons" onClick={bookmarkClick} />
            :
            <PiBookmarkSimpleFill title="Remover tópico dos salvos" className="icons" onClick={bookmarkClick} />
          }
        </div>
        {posts.length > 0 ?
          posts.map(post => {
            return (
              <div>
                <div className="post-percentage-bar" style={{ width: `${post.percentage}%` }}>
                  <span>{post.shortAnswer}</span>
                  <span>{`${post.percentage}%`}</span>
                </div>
                {post.summary}
                <span className="unselectable read-more">continuar...</span>
              </div>
            )
          })
          :
          "Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum."
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