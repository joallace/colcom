import React from "react"
import {
  PiCaretRight,
  PiCaretDoubleRight,
  PiCaretDoubleLeft,
  PiCaretLeft
} from "react-icons/pi"
import { Link } from "react-router-dom"


export default function Pagination({ path = "", state, isLoading, maxIndex = -1 }) {
  const [index, setIndex] = state
  const [pages, setPages] = React.useState([...Array(maxIndex >= 0 ? Math.min(maxIndex + 1, 5) : 5).keys()])
  const refs = pages.map(_ => React.useRef(null))

  const nextPage = () => {
    setIndex(index + 1)
  }

  const previousPage = () => {
    setIndex(index - 1)
  }

  React.useEffect(() => {
    if (pages.length !== 5)
      return

    if (index >= 2 && (maxIndex <= 0 || index <= maxIndex - 2))
      setPages(Array.from({ length: 5 }, (_, k) => k + index - 2))
    else if (index < 4)
      setPages(Array.from({ length: 5 }, (_, k) => k))
    else
      setPages(Array.from({ length: 5 }, (_, k) => maxIndex + k - 4))
  }, [index, maxIndex])

  return (
    <>
      <div className="pagination">
        <Link
          to={path}
          className={`icons${index === 0 ? " disabled" : ""}`}
          onClick={() => setIndex(0)}
        >
          <PiCaretDoubleLeft />
        </Link>

        <Link
          to={index === 1 ? path : `${path}?p=${index}`}
          className={`icons${(index === 0 || (maxIndex >= 0 && index>maxIndex+1)) ? " disabled" : ""}`}
          onClick={previousPage}
        >
          <PiCaretLeft />
        </Link>

        <div className="pages">
          {pages.map((page, i) => (
            <Link
              key={`pag_${i + 1}`}
              to={page === 0 ? path : `${path}?p=${page + 1}`}
              className={`${(index !== page && (maxIndex >= 0 && page > maxIndex)) ? "disabled" : ""}${index === page ? " active" : ""}`}
              contentEditable={index === page}
              suppressContentEditableWarning={true}
              disabled={maxIndex >= 0 && page > maxIndex}
              active={String(index === page)}
              onClick={() => { index !== page && setIndex(page) }}
              ref={refs[i]}
              onBlur={_ => {
                refs[i].current.innerHTML = page + 1
              }}
              onKeyDown={e => {
                const content = e.target.textContent

                if (e.key === "Enter") {
                  e.preventDefault()
                  const value = +content - 1

                  if (value < 0) {
                    setIndex(0)
                    return
                  }

                  if (maxIndex >= 0 && value > maxIndex) {
                    setIndex(maxIndex)
                    return
                  }

                  setIndex(value)
                }

                if (!(["Backspace", "Delete", "ArrowRight", "ArrowLeft"].includes(e.key)) && !/\d/.test(e.key)) {
                  e.preventDefault()
                }
              }}
            >
              {page + 1}
            </Link>
          )
          )}
        </div>

        <Link
          to={`${path}?p=${index + 2}`}
          className={`icons${(maxIndex >= 0 ? index >= maxIndex : isLoading) ? " disabled" : ""}`}
          onClick={nextPage}
        >
          <PiCaretRight />
        </Link>
        <Link
          to={`${path}?p=${maxIndex + 1}`}
          className={`icons${((maxIndex >= 0 && index >= maxIndex) || isLoading || maxIndex < 0) ? " disabled" : ""}`}
          onClick={() => setIndex(maxIndex)}
        >
          <PiCaretDoubleRight />
        </Link>
      </div>
    </>
  );
}