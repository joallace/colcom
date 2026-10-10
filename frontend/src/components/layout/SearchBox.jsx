import React from "react"
import { useNavigate } from "react-router"
import { PiMagnifyingGlassBold, PiX } from "react-icons/pi"

import { hashtagAt, searchPath, splitQuery } from "@/assets/search"
import { searchTags, tagSlug } from "@/assets/tags"
import { limits } from "@/assets/validation"


// A search field that opens the search page (pages/Search), keeping `type`. Words search titles and
// texts; a word starting with "#" offers tags instead, and a picked tag becomes a pill. Several
// tags search their intersection, as /t/a+b does. A "#tag" typed in full and not picked counts too.
// `initialTags` are { slug, name? }; a tag without a name shows the one in `tagNames` (a Map from
// slugs), or its slug.
export default function SearchBox({ initialQuery = "", initialTags = [], tagNames, type, autoFocus = false, className = "" }) {
  const [text, setText] = React.useState(initialQuery)
  const [tags, setTags] = React.useState(initialTags)
  const [caret, setCaret] = React.useState(null)
  const [found, setFound] = React.useState({ slug: null, tags: [] })
  const [active, setActive] = React.useState(-1)
  // The "#word" whose suggestions Escape closed, so they stay closed until another one is typed
  const [dismissed, setDismissed] = React.useState(null)
  const inputRef = React.useRef(null)
  // Where the caret goes once a picked tag's "#word" has left the text
  const nextCaret = React.useRef(null)
  const navigate = useNavigate()
  const listId = `${React.useId()}-tags`

  const full = tags.length >= limits.tags.filter
  const hashtag = caret === null ? null : hashtagAt(text, caret)
  const slug = hashtag && !full ? tagSlug(hashtag.query) : null
  const key = hashtag && `${hashtag.start}:${hashtag.query}`

  React.useEffect(() => {
    if (slug === null)
      return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        setFound({ slug, tags: (await searchTags(slug, { signal: controller.signal })) ?? [] })
      }
      catch (err) {
        if (err.name !== "AbortError")
          console.error(err)
      }
    }, 150)

    return () => {
      clearTimeout(timer)
      controller.abort()
    }
  }, [slug])

  React.useLayoutEffect(() => {
    if (nextCaret.current === null)
      return
    inputRef.current?.setSelectionRange(nextCaret.current, nextCaret.current)
    nextCaret.current = null
  }, [text])

  // Only what was found for the current "#word", so a slow answer never offers stale tags
  const options = slug !== null && found.slug === slug ? found.tags.filter(tag => !tags.some(chosen => chosen.slug === tag.slug)) : []
  const open = options.length > 0 && key !== dismissed

  const pick = tag => {
    const before = text.slice(0, hashtag.start)
    const after = text.slice(hashtag.end).replace(/^\s+/, "")
    nextCaret.current = before.length
    setText(before + after)
    setCaret(before.length)
    setTags([...tags, { slug: tag.slug, name: tag.name }])
    setActive(-1)
    inputRef.current?.focus()
  }

  const remove = slug => {
    setTags(tags.filter(tag => tag.slug !== slug))
    inputRef.current?.focus()
  }

  const submit = event => {
    event.preventDefault()
    const { q, tags: typed } = splitQuery(text)
    const slugs = [...new Set([...tags.map(tag => tag.slug), ...typed])].slice(0, limits.tags.filter)
    if (q || slugs.length > 0)
      navigate(searchPath({ q, type, tags: slugs }))
  }

  const onKeyDown = event => {
    if (open && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
      event.preventDefault()
      const step = event.key === "ArrowDown" ? 1 : -1
      setActive(index => (index + step + options.length) % options.length)
    }
    // Picks a tag rather than searching: with the list open, Enter completes the "#word"
    else if (open && (event.key === "Enter" || event.key === "Tab")) {
      event.preventDefault()
      pick(options[Math.max(active, 0)])
    }
    else if (open && event.key === "Escape") {
      event.preventDefault()
      setDismissed(key)
    }
    else if (event.key === "Backspace" && tags.length > 0 && event.target.selectionStart === 0 && event.target.selectionEnd === 0)
      setTags(tags.slice(0, -1))
  }

  const trackCaret = event => setCaret(event.target.selectionStart)

  return (
    <form role="search" className={`searchBox${className && ` ${className}`}`} onSubmit={submit}>
      <div className="searchField" onClick={() => inputRef.current?.focus()}>
        {tags.length > 0 &&
          <ul className="searchTags" aria-label="tags da busca">
            {tags.map(tag => tag.name ?? tagNames?.get(tag.slug) ?? tag.slug).map((name, index) => (
              <li key={tags[index].slug}>
                #{name}
                <button type="button" title={`remover #${name}`} onClick={() => remove(tags[index].slug)}>
                  <PiX aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        }
        <input
          ref={inputRef}
          type="search"
          aria-label="buscar"
          placeholder={tags.length > 0 ? "" : "buscar, ou # para tags"}
          value={text}
          maxLength={limits.search.max}
          autoFocus={autoFocus}
          autoComplete="off"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listId}
          aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
          onChange={event => { setText(event.target.value); trackCaret(event); setActive(-1) }}
          onSelect={trackCaret}
          onKeyDown={onKeyDown}
          onBlur={() => setCaret(null)}
        />
      </div>
      <button type="submit" className="searchSubmit" title="buscar">
        <PiMagnifyingGlassBold aria-hidden />
      </button>
      {open &&
        <ul className="tagSuggestions" role="listbox" id={listId} aria-label="tags sugeridas">
          {options.map((tag, index) => (
            <li
              key={tag.slug}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              // Before the input's blur, so the click lands
              onMouseDown={event => { event.preventDefault(); pick(tag) }}
            >
              <span>#{tag.name}</span>
              <span className="detail">{tag.topics} tópico{tag.topics === 1 ? "" : "s"}</span>
            </li>
          ))}
        </ul>
      }
    </form>
  )
}
