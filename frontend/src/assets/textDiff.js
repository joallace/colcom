import diff from "fast-diff"


// Words, single whitespace characters (block breaks stay apart) and any other single character
const TOKEN = /[\p{L}\p{N}_]+|\s|[^\p{L}\p{N}_\s]/gu
// Tokens become one UTF-16 code unit each, skipping the surrogate range so none is split in two
const FIRST_CODE = 0x100
const SURROGATES = [0xD800, 0xE000]
const LAST_CODE = 0xFFFF

// Two unrelated sentences still share spaces, punctuation and small words, and a raw diff keeps
// those, alternating removed and added words. As diff-match-patch's semantic cleanup does, text kept
// between two changes joins them when it has no letters or digits, or is no longer than either.
function cleanupSemantic(edits) {
  const result = []
  let removed = "", added = ""

  const flush = () => {
    if (removed) result.push([diff.DELETE, removed])
    if (added) result.push([diff.INSERT, added])
    removed = added = ""
  }

  // Length of the change that starts at `start`, up to the next kept text
  const changeAt = start => {
    let length = 0
    for (let i = start; i < edits.length && edits[i][0] !== diff.EQUAL; i++)
      length = Math.max(length, edits[i][1].length)
    return length
  }

  edits.forEach(([operation, text], i) => {
    if (operation === diff.DELETE)
      removed += text
    else if (operation === diff.INSERT)
      added += text
    else {
      const before = Math.max(removed.length, added.length)
      const after = changeAt(i + 1)
      const isFiller = !/[\p{L}\p{N}]/u.test(text)

      if (before > 0 && after > 0 && (isFiller || (text.length <= before && text.length <= after))) {
        removed += text
        added += text
        return
      }
      flush()
      result.push([diff.EQUAL, text])
    }
  })

  flush()
  return result
}

// Diffs two texts word by word, so a changed word shows as that word replaced rather than as
// scattered letters. Returns fast-diff's [operation, text] pairs, over the original characters.
export function diffWords(oldText, newText) {
  const codeOf = new Map()
  const tokenOf = new Map()

  const encode = text => (text.match(TOKEN) ?? []).map(token => {
    if (!codeOf.has(token)) {
      let code = FIRST_CODE + codeOf.size
      if (code >= SURROGATES[0])
        code += SURROGATES[1] - SURROGATES[0]
      if (code > LAST_CODE)
        throw new RangeError("too many distinct words")

      const char = String.fromCharCode(code)
      codeOf.set(token, char)
      tokenOf.set(char, token)
    }
    return codeOf.get(token)
  }).join("")

  try {
    return cleanupSemantic(diff(encode(oldText), encode(newText))
      .map(([operation, encoded]) => [operation, [...encoded].map(char => tokenOf.get(char)).join("")]))
  }
  catch (err) {
    // A text with more distinct words than code units falls back to comparing characters
    if (err instanceof RangeError)
      return diff(oldText, newText)
    throw err
  }
}

export { diff }
