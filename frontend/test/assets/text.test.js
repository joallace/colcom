import { describe, expect, it } from "vitest"

import { docFromHtml } from "@/assets/anchoring"
import textIndex from "@/assets/textIndex"
import { diff, diffWords } from "@/assets/textDiff"


describe("textIndex", () => {
  it("joins blocks with line breaks and maps each character to its position", () => {
    const doc = docFromHtml("<p>ab</p><p>c</p>")
    const { text, positions } = textIndex(doc)

    expect(text).toBe("ab\nc")
    // <p> opens at 0, so "a" is at 1; the second <p> opens at 4, so "c" is at 5
    expect(positions).toEqual([1, 2, null, 5])
    expect(doc.textBetween(positions[0], positions[1] + 1)).toBe("ab")
  })

  it("separates nested blocks once", () => {
    const { text } = textIndex(docFromHtml("<ul><li><p>one</p></li><li><p>two</p></li></ul><p>three</p>"))
    expect(text).toBe("one\ntwo\nthree")
  })

  it("treats hard breaks as separators", () => {
    expect(textIndex(docFromHtml("<p>line<br>break</p>")).text).toBe("line\nbreak")
  })

  it("skips empty paragraphs without doubling separators", () => {
    expect(textIndex(docFromHtml("<p>a</p><p></p><p></p><p>b</p>")).text).toBe("a\nb")
  })

  it("is empty for an empty document", () => {
    expect(textIndex(docFromHtml(""))).toEqual({ text: "", positions: [] })
  })

  it("maps every character of marked text", () => {
    const doc = docFromHtml("<p>a <strong>bold</strong> <em>move</em></p>")
    const { text, positions } = textIndex(doc)

    expect(text).toBe("a bold move")
    for (const [i, char] of [...text].entries())
      expect(doc.textBetween(positions[i], positions[i] + 1)).toBe(char)
  })
})

const apply = edits => ({
  old: edits.filter(([op]) => op !== diff.INSERT).map(([, text]) => text).join(""),
  new: edits.filter(([op]) => op !== diff.DELETE).map(([, text]) => text).join("")
})

describe("diffWords", () => {
  it("replaces whole words rather than letters", () => {
    expect(diffWords("the cat sat", "the car sat")).toEqual([
      [diff.EQUAL, "the "],
      [diff.DELETE, "cat"],
      [diff.INSERT, "car"],
      [diff.EQUAL, " sat"]
    ])
  })

  it("reports insertions and deletions", () => {
    expect(diffWords("a c", "a b c")).toEqual([[diff.EQUAL, "a "], [diff.INSERT, "b "], [diff.EQUAL, "c"]])
    expect(diffWords("a b c", "a c")).toEqual([[diff.EQUAL, "a "], [diff.DELETE, "b "], [diff.EQUAL, "c"]])
  })

  it("joins unrelated sentences into one change instead of keeping their spaces", () => {
    const edits = diffWords("Cats chase mice at night", "Dogs bark loudly in daytime")
    expect(edits).toEqual([[diff.DELETE, "Cats chase mice at night"], [diff.INSERT, "Dogs bark loudly in daytime"]])
  })

  it("keeps a long unchanged stretch between two changes", () => {
    const edits = diffWords("one alpha beta gamma delta two", "uno alpha beta gamma delta dos")
    expect(edits).toContainEqual([diff.EQUAL, " alpha beta gamma delta "])
  })

  it.each([
    ["", "something"],
    ["something", ""],
    ["same", "same"],
    ["Ação é ótima, não?", "Ação é péssima, não!"],
    ["emoji 🎉 party", "emoji 🎊 party"],
    ["line\nbreak", "line\n\nbreak"],
  ])("always rebuilds both texts (%j → %j)", (oldText, newText) => {
    expect(apply(diffWords(oldText, newText))).toEqual({ old: oldText, new: newText })
  })

  it("compares characters when there are more distinct words than code units", () => {
    const words = Array.from({ length: 66000 }, (_, i) => `w${i}`).join(" ")
    const edits = diffWords(words, words + " end")

    expect(apply(edits)).toEqual({ old: words, new: words + " end" })
  })

  it("never splits a word in a surrogate pair", () => {
    // Over 0xD800 - 0x100 distinct words push codes past the surrogate range
    const many = Array.from({ length: 0xD800 }, (_, i) => `w${i}`).join(" ")
    const edits = diffWords(many, many.replace("w55000", "changed"))

    expect(apply(edits).new).toContain("changed")
    expect(edits.filter(([op]) => op === diff.DELETE)).toEqual([[diff.DELETE, "w55000"]])
  })
})
