import {
  PiCaretRight,
  PiCaretDoubleRight,
  PiCaretDoubleLeft,
  PiCaretLeft
} from "react-icons/pi"
import { Link } from "react-router"


// Up to 5 page indexes, centred on the current one when it isn't near either end
function visiblePages(index, maxIndex) {
  const count = Math.min(maxIndex + 1, 5)
  let first = 0

  if (count === 5) {
    if (index >= 2 && index <= maxIndex - 2)
      first = index - 2
    else if (index >= 4)
      first = maxIndex - 4
  }

  return Array.from({ length: count }, (_, k) => first + k)
}

export default function Pagination({ path = "", state, isLoading, maxIndex = -1 }) {
  if (maxIndex < 1) return

  const [index, setIndex] = state
  const pages = visiblePages(index, maxIndex)

  const nextPage = () => {
    setIndex(index + 1)
  }

  const previousPage = () => {
    setIndex(index - 1)
  }

  return (
    <>
      <div className="pagination">
        <Link
          to={path}
          className={`clickable${index === 0 ? " disabled" : ""}`}
          onClick={() => setIndex(0)}
        >
          <PiCaretDoubleLeft />
        </Link>

        <Link
          to={index === 1 ? path : `${path}?p=${index}`}
          className={`clickable${(index === 0 || (maxIndex >= 0 && index > maxIndex + 1)) ? " disabled" : ""}`}
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
              onBlur={e => {
                e.target.textContent = page + 1
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
          className={`clickable${(maxIndex >= 0 ? index >= maxIndex : isLoading) ? " disabled" : ""}`}
          onClick={nextPage}
        >
          <PiCaretRight />
        </Link>
        <Link
          to={`${path}?p=${maxIndex + 1}`}
          className={`clickable${((maxIndex >= 0 && index >= maxIndex) || isLoading || maxIndex < 0) ? " disabled" : ""}`}
          onClick={() => setIndex(maxIndex)}
        >
          <PiCaretDoubleRight />
        </Link>
      </div>
    </>
  );
}