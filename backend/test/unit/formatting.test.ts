import { describe, expect, it, vi } from "vitest"

// summarize lives with the content model, whose database pool would otherwise try to connect
vi.mock("@/pgDatabase", () => ({ default: {} }))

const { formatHtml } = await import("@/gitDatabase")
const { summarize } = await import("@/models/content")


describe("formatHtml", () => {
  it("puts each block element on its own line", () => {
    expect(formatHtml("<h2>Title</h2><p>One</p><ul><li>a</li><li>b</li></ul><hr><blockquote><p>q</p></blockquote>"))
      .toBe("<h2>Title</h2>\n<p>One</p>\n<ul><li>a</li>\n<li>b</li>\n</ul>\n<hr>\n<blockquote><p>q</p>\n</blockquote>\n")
  })

  it("breaks tables by row and charts", () => {
    expect(formatHtml("<table><tbody><tr><td>1</td></tr><tr><td>2</td></tr></tbody></table><chart data=\"[]\"></chart>"))
      .toBe("<table><tbody><tr><td>1</td></tr>\n<tr><td>2</td></tr>\n</tbody>\n</table>\n<chart data=\"[]\"></chart>\n")
  })

  it("is idempotent, so an unchanged text stays unchanged", () => {
    const once = formatHtml("<p>One</p><p>Two</p><pre><code>x\n\ny</code></pre><p>Three</p>")
    expect(formatHtml(once)).toBe(once)
  })

  it("leaves code blocks untouched, since their whitespace is meaningful", () => {
    expect(formatHtml("<p>a</p><pre><code>if (x) {\n  <p>not a block</p>\n}</code></pre><p>b</p>"))
      .toBe("<p>a</p>\n<pre><code>if (x) {\n  <p>not a block</p>\n}</code></pre>\n<p>b</p>\n")
  })

  it("leaves inline elements on their line", () => {
    expect(formatHtml("<p>Some <strong>bold</strong> and <em>italic</em><br>text</p>")).toBe("<p>Some <strong>bold</strong> and <em>italic</em><br>text</p>\n")
  })

  it("handles an empty document", () => {
    expect(formatHtml("")).toBe("")
  })
})

describe("summarize", () => {
  it("is the first non-empty paragraph, keeping inline markup", () => {
    expect(summarize("<h2>Heading</h2><p></p><p>  </p><p>The <em>real</em> start.</p><p>Later.</p>")).toBe("The <em>real</em> start.")
  })

  it("accepts paragraphs with attributes", () => {
    expect(summarize('<p class="lead">Lead.</p>')).toBe("Lead.")
  })

  it("falls back to the plain text when there are no paragraphs", () => {
    expect(summarize("<table><tr><td>a</td><td>b</td></tr></table>")).toBe("a b")
  })

  it("is cut at 280 characters", () => {
    expect(summarize(`<p>${"x".repeat(500)}</p>`)).toHaveLength(280)
  })

  it.each([undefined, null, 42, {}])("is empty for %j", value => {
    expect(summarize(value)).toBe("")
  })

  it("doesn't take <pre> for a paragraph", () => {
    expect(summarize("<pre>code</pre><p>Text.</p>")).toBe("Text.")
  })
})
