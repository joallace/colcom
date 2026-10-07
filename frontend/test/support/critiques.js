import { docFromHtml, quoteFromRange } from "@/assets/anchoring"
import textIndex from "@/assets/textIndex"


// Makes a critique the way the post page does: the reader selects `exact` (its `occurrence`-th
// appearance) in the version `commit`, whose text is `html`
export function critiqueOn(html, commit, exact, occurrence = 0) {
  const doc = docFromHtml(html)
  const { text, positions } = textIndex(doc)

  let at = -1
  for (let i = 0; i <= occurrence; i++) {
    at = text.indexOf(exact, at + 1)
    if (at === -1)
      throw new Error(`"${exact}" doesn't appear ${occurrence + 1} time(s) in ${JSON.stringify(text)}`)
  }

  const from = positions[at]
  const to = positions[at + exact.length - 1] + 1
  return { id: `${commit}:${exact}:${occurrence}`, config: { commit, from, to, quote: quoteFromRange(doc, from, to) } }
}

// The text an anchor lands on in `html`, blocks separated by "\n"
export const textAt = (html, { from, to }) => docFromHtml(html).textBetween(from, to, "\n")

// The `n`-th occurrence's offset in the document's text
export function offsetOf(html, str, n = 0) {
  const { text } = textIndex(docFromHtml(html))
  let at = -1
  for (let i = 0; i <= n; i++)
    at = text.indexOf(str, at + 1)
  return at
}

export const p = (...paragraphs) => paragraphs.map(text => `<p>${text}</p>`).join("")

// A chart as the chart modal writes it
export const chart = (label = "A") => `<chart type="bar" isLegendOn="true" data="[{'name':'${label}','valor':1}]"></chart>`
