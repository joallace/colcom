import { excerptParts } from "@/assets/search"


// The part of a search result's text around the words that matched, which are marked
export default function Excerpt({ excerpt }) {
  return (
    <p className="searchExcerpt">
      {excerptParts(excerpt).map((part, index) =>
        part.match ? <mark key={index}>{part.text}</mark> : part.text
      )}
    </p>
  )
}
