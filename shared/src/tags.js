// Tags are identified by their slug, so "Política", "politica" and "POLÍTICA" are one tag. The
// frontend shows the slug as it's typed and the backend stores it; both use this function.
export const tagSlug = name => String(name)
  .trim()
  .normalize("NFD")
  // Combining marks, i.e. the accents NFD split from their letters
  .replace(/\p{M}/gu, "")
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, "-")
  .replace(/^-+|-+$/g, "")

// Letters that NFD turns into an ASCII letter and a mark, so each is one character of the slug
const LETTERS = "a-zA-Z0-9áàâãäéèêëíìîïóòôõöúùûüçñýÿÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑÝ"

// A tag's name: words of those letters and digits, joined by single spaces or hyphens. Its slug then
// has exactly its length, so the schema's length limits are the slug's.
export const TAG_NAME_PATTERN = `^[${LETTERS}]+(?:[ -][${LETTERS}]+)*$`

// A slug, as it appears in links and filters
export const TAG_SLUG_PATTERN = "^[a-z0-9]+(?:-[a-z0-9]+)*$"
