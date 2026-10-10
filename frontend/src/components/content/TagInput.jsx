import React from "react"

import Input from "@/components/primitives/Input"
import { searchTags, tagSlug } from "@/assets/tags"
import { formErrors, limits } from "@/assets/validation"


// A field to pick a tag: suggests existing ones as it's typed (those starting with it first) and
// offers to create the typed one when no tag has its slug. `onPick` gets the name; tags whose slug
// is in `exclude` (already chosen) aren't offered.
export default function TagInput({ onPick, exclude = [], label = "adicionar tag", disabled = false }) {
  const [text, setText] = React.useState("")
  const [found, setFound] = React.useState({ slug: "", tags: [] })
  const [active, setActive] = React.useState(-1)
  const [error, setError] = React.useState("")
  // Input labels its field by id
  const inputId = React.useId()
  const listId = `${inputId}-list`
  const slug = tagSlug(text)

  React.useEffect(() => {
    if (!slug)
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

  // Only what was found for the current text, so a slow answer never offers stale tags
  const suggestions = slug && found.slug === slug ? found.tags.filter(tag => !exclude.includes(tag.slug)) : []
  const canCreate = slug !== "" && !exclude.includes(slug) && !suggestions.some(tag => tag.slug === slug)
  const options = [
    ...suggestions.map(tag => ({ key: tag.slug, name: tag.name, text: tag.name, detail: `${tag.topics} tópico${tag.topics === 1 ? "" : "s"}` })),
    ...(canCreate ? [{ key: "", name: text.trim(), text: `criar "${text.trim()}"`, detail: slug }] : [])
  ]
  const open = options.length > 0 && !disabled

  const pick = name => {
    const invalid = formErrors("tagVote", { tag: name, value: 1 }).tag
    if (invalid) {
      setError(invalid)
      return
    }
    onPick(name)
    setText("")
    setActive(-1)
  }

  const onKeyDown = e => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault()
      const step = e.key === "ArrowDown" ? 1 : -1
      setActive(index => options.length ? (index + step + options.length) % options.length : -1)
    }
    else if (e.key === "Enter") {
      e.preventDefault()
      const option = options[active] ?? options.find(option => option.key === slug) ?? options.at(-1)
      if (option)
        pick(option.name)
      else if (exclude.includes(slug))
        setError("tag já adicionada")
    }
    else if (e.key === "Escape" && text) {
      // Clears the field instead of closing the popover around it
      e.stopPropagation()
      setText("")
    }
  }

  return (
    <div className="tagInput">
      <Input
        id={inputId}
        type="text"
        label={label}
        value={text}
        maxLength={limits.tag.max}
        disabled={disabled}
        autoComplete="off"
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={open}
        aria-controls={listId}
        aria-activedescendant={open && active >= 0 ? `${listId}-${active}` : undefined}
        onChange={e => { setText(e.target.value); setActive(-1); setError("") }}
        onKeyDown={onKeyDown}
        errorMessage={error && `${error}!`}
      />
      {open &&
        <ul className="tagSuggestions" role="listbox" id={listId} aria-label="tags sugeridas">
          {options.map((option, index) => (
            <li
              key={option.key || "new"}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              className={option.key ? undefined : "create"}
              // Before the input's blur, so the click lands
              onMouseDown={e => { e.preventDefault(); pick(option.name) }}
            >
              <span>{option.text}</span>
              <span className="detail">{option.detail}</span>
            </li>
          ))}
        </ul>
      }
    </div>
  )
}
