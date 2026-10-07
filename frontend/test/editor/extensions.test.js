// The editor's own extensions, in a real TipTap editor
import { Editor } from "@tiptap/core"
import { afterEach, describe, expect, it, vi } from "vitest"

import getExtensions from "@/components/Editor/extensions"
import { docFromHtml } from "@/assets/anchoring"
import { chart } from "../support/critiques"


let editor

const createEditor = (content, options = {}) => {
  editor = new Editor({ element: document.createElement("div"), extensions: getExtensions(options), content })
  return editor
}

afterEach(() => {
  editor?.destroy()
  editor = undefined
})

describe("the schema", () => {
  it("parses a post exactly as critique anchoring does", () => {
    const html = "<h2>Title</h2><p>Some <strong>bold</strong> <em>text</em></p><ul><li><p>a</p></li></ul><blockquote><p>q</p></blockquote><pre><code>x</code></pre><table><tbody><tr><td><p>cell</p></td></tr></tbody></table>"
    createEditor(html)

    expect(editor.state.doc.toJSON()).toEqual(docFromHtml(html).toJSON())
  })

  it("doesn't append a trailing paragraph", () => {
    createEditor("<h2>Only a heading</h2>")
    expect(editor.state.doc.childCount).toBe(1)
  })

  it("only allows level 2 and 3 headings, other levels become paragraphs", () => {
    createEditor("<h1>One</h1><h3>Three</h3><h4>Four</h4>")
    expect(editor.state.doc.content.content.map(node => node.attrs.level ?? node.type.name)).toEqual(["paragraph", 3, "paragraph"])
  })

  it("drops links and underlines, which aren't part of the schema", () => {
    createEditor('<p><a href="https://example.com">link</a> <u>under</u></p>')
    expect(editor.getHTML()).toBe("<p>link under</p>")
  })
})

describe("the critique highlight mark", () => {
  it("renders its index, level and type, and round-trips through HTML", () => {
    createEditor('<p>a <mark class="changed" data-commit-index="[1,2]" data-level="2">b</mark> c</p>')

    const mark = editor.view.dom.querySelector("mark")
    expect(mark).toHaveClass("changed")
    expect(mark).toHaveAttribute("data-commit-index", "[1,2]")
    expect(mark).toHaveAttribute("data-level", "2")
    expect(editor.getHTML()).toBe('<p>a <mark class="changed" data-commit-index="[1,2]" data-level="2">b</mark> c</p>')
  })

  it("is definitive by default", () => {
    createEditor("<p>text</p>")
    editor.chain().setTextSelection({ from: 1, to: 3 }).setHighlight({ index: "0" }).run()

    expect(editor.view.dom.querySelector("mark")).toHaveClass("definitive")
    expect(editor.view.dom.querySelector("mark")).toHaveAttribute("data-commit-index", "0")
  })

  it("opens its critiques when clicked", () => {
    const setShowCritique = vi.fn()
    createEditor('<p><mark data-commit-index="3">criticised</mark></p>', { setShowCritique })

    editor.view.dom.querySelector("mark").click()

    expect(setShowCritique).toHaveBeenCalledWith("3")
  })

  it("can be toggled and removed", () => {
    createEditor("<p>text</p>")
    editor.chain().selectAll().toggleHighlight({ index: "1" }).run()
    expect(editor.getHTML()).toContain("<mark")

    editor.chain().selectAll().unsetHighlight().run()
    expect(editor.getHTML()).toBe("<p>text</p>")
  })
})

describe("highlightRange", () => {
  const chartNode = () => editor.state.doc.content.content.find(node => node.type.name === "chart")

  it("highlights text without moving the selection", () => {
    createEditor("<p>some text</p>")
    editor.commands.setTextSelection(1)
    editor.commands.highlightRange({ from: 6, to: 10 }, { index: "2", level: 1 })

    expect(editor.getHTML()).toBe('<p>some <mark class="definitive" data-commit-index="2" data-level="1">text</mark></p>')
    expect(editor.state.selection.from).toBe(1)
  })

  it("highlights a chart, which marks can't cover, through its attributes", () => {
    createEditor(`<p>Before.</p>${chart()}`)
    const pos = 9
    expect(editor.state.doc.nodeAt(pos).type.name).toBe("chart")

    editor.commands.highlightRange({ from: pos, to: pos + 1 }, { type: "changed", index: "[0,1]", level: 2 })

    expect(chartNode().attrs).toMatchObject({ highlight: "changed", highlightIndex: "[0,1]", highlightLevel: 2 })
    expect(editor.getHTML()).not.toContain("<mark")
  })

  it("keeps a chart's highlight through its HTML, as content is reloaded with it", () => {
    createEditor(`<p>Before.</p>${chart()}`)
    editor.commands.highlightRange({ from: 9, to: 10 }, { index: "4", level: 1 })
    editor.commands.setContent(editor.getHTML())

    expect(chartNode().attrs).toMatchObject({ highlight: "definitive", highlightIndex: "4", highlightLevel: "1" })
  })

  it("covers both the text and the charts of a range", () => {
    createEditor(`<p>Before.</p>${chart()}<p>After.</p>`)
    editor.commands.highlightRange({ from: 0, to: editor.state.doc.content.size }, { type: "temporary" })

    expect(editor.view.dom.querySelectorAll("mark.temporary")).toHaveLength(2)
    expect(chartNode().attrs.highlight).toBe("temporary")
  })

  // The critique popover finds an opened critique's passage by its index
  it("keeps the index and level of a passage it turns temporary", () => {
    createEditor(`<p><mark class="definitive" data-commit-index="3" data-level="2">criticised</mark></p>${chart()}`)
    editor.commands.highlightRange({ from: 12, to: 13 }, { index: "4", level: 1 })

    editor.commands.highlightRange({ from: 0, to: editor.state.doc.content.size }, { type: "temporary" })

    expect(editor.getHTML()).toContain('<mark class="temporary" data-commit-index="3" data-level="2">criticised</mark>')
    expect(chartNode().attrs).toMatchObject({ highlight: "temporary", highlightIndex: "4", highlightLevel: 1 })
  })

  it("leaves charts without a highlight unchanged in the HTML", () => {
    createEditor(chart())
    expect(editor.getHTML()).not.toMatch(/data-highlight|data-commit-index|data-level/)
  })
})

describe("the suggestion diff highlight", () => {
  const inserted = () => [...editor.view.dom.querySelectorAll(".diffInsert")].map(element => element.textContent)
  const deleted = () => [...editor.view.dom.querySelectorAll(".diffDelete")].map(element => element.textContent)

  it("highlights added words and shows removed ones where they were", () => {
    createEditor("<p>The quick red fox jumps.</p>")
    editor.commands.setDiffBase("<p>The quick brown fox jumps.</p>")

    expect(inserted()).toEqual(["red"])
    expect(deleted()).toEqual(["brown"])
  })

  it("never changes the document", () => {
    createEditor("<p>The quick red fox jumps.</p>")
    const before = editor.getHTML()

    editor.commands.setDiffBase("<p>Something else entirely.</p>")

    expect(editor.getHTML()).toBe(before)
  })

  it("shows removed paragraph breaks as pilcrows", () => {
    createEditor("<p>First.</p><p>Last.</p>")
    editor.commands.setDiffBase("<p>First.</p><p>Gone sentence.</p><p>Last.</p>")

    expect(deleted()).toEqual(["Gone sentence. ¶ "])
  })

  it("doesn't draw a removed line break alone", () => {
    createEditor("<p>First. Second.</p>")
    editor.commands.setDiffBase("<p>First.</p><p>Second.</p>")

    expect(deleted()).toEqual([])
  })

  it("highlights added text across paragraphs", () => {
    createEditor("<p>Kept.</p><p>Brand new paragraph.</p>")
    editor.commands.setDiffBase("<p>Kept.</p>")

    expect(inserted().join("")).toBe("Brand new paragraph.")
  })

  it("stops when the base is cleared", () => {
    createEditor("<p>new text</p>")
    editor.commands.setDiffBase("<p>old text</p>")
    expect(inserted()).not.toEqual([])

    editor.commands.setDiffBase(null)

    expect(inserted()).toEqual([])
    expect(deleted()).toEqual([])
  })

  it("follows edits made after the base was set", () => {
    createEditor("<p>alpha beta</p>")
    editor.commands.setDiffBase("<p>alpha beta</p>")
    expect(inserted()).toEqual([])

    editor.chain().setTextSelection(editor.state.doc.content.size - 1).insertContent(" gamma").run()

    expect(inserted().join("")).toBe(" gamma")
  })
})
