import React from "react"
import { useNavigate } from "react-router"
import { PiMagnifyingGlassBold } from "react-icons/pi"

import { searchPath } from "@/assets/search"
import { limits } from "@/assets/validation"


// A search field that opens the search page (pages/Search) with what was typed, keeping `type`
export default function SearchBox({ initialQuery = "", type, autoFocus = false, className = "" }) {
  const [query, setQuery] = React.useState(initialQuery)
  const navigate = useNavigate()

  const submit = event => {
    event.preventDefault()
    const q = query.trim()
    if (q)
      navigate(searchPath({ q, type }))
  }

  return (
    <form role="search" className={`searchBox${className && ` ${className}`}`} onSubmit={submit}>
      <input
        type="search"
        aria-label="buscar"
        placeholder="buscar tópicos e posts"
        value={query}
        maxLength={limits.search.max}
        autoFocus={autoFocus}
        onChange={event => setQuery(event.target.value)}
      />
      <button type="submit" title="buscar">
        <PiMagnifyingGlassBold aria-hidden />
      </button>
    </form>
  )
}
