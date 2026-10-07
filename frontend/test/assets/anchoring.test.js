import { describe, expect, it } from "vitest"

import { docFromHtml, projectCritiques, quoteFromRange } from "@/assets/anchoring"
import textIndex, { CHART_TEXT } from "@/assets/textIndex"
import { chart, critiqueOn, offsetOf, p, textAt } from "../support/critiques"


const LOREM = "Lorem ipsum dolor sit amet, consectetur adipiscing elit."

// Projects critiques made on earlier versions onto the last of `chain` ([commit, html] pairs),
// sending every version in between, as the backend does
function projectThrough(chain, critiques) {
  const [commit, html] = chain.at(-1)
  const versions = Object.fromEntries(chain.slice(0, -1))
  const lineages = {}
  for (const critique of critiques) {
    const start = chain.findIndex(([version]) => version === critique.config.commit)
    lineages[critique.config.commit] = chain.slice(start).map(([version]) => version)
  }
  return projectCritiques(html, critiques, commit, versions, lineages)
}

describe("docFromHtml", () => {
  it("parses with the editor's schema", () => {
    const doc = docFromHtml("<h2>Title</h2><p>Some <strong>bold</strong> text</p><ul><li><p>item</p></li></ul>")

    expect(doc.child(0).type.name).toBe("heading")
    expect(doc.child(0).attrs.level).toBe(2)
    expect(doc.child(1).textContent).toBe("Some bold text")
    expect(doc.child(2).type.name).toBe("bulletList")
  })

  it("keeps critique highlights as marks", () => {
    const doc = docFromHtml('<p>a <mark data-commit-index="3">b</mark></p>')
    expect(doc.child(0).child(1).marks.map(mark => mark.type.name)).toEqual(["highlight"])
  })

  it("never runs scripts or event handlers from the HTML", () => {
    window.pwned = false
    docFromHtml('<p>x</p><img src="nowhere" onerror="window.pwned = true"><script>window.pwned = true</script>')
    expect(window.pwned).toBe(false)
  })

  it("treats a missing body as an empty document", () => {
    expect(docFromHtml(undefined).textContent).toBe("")
  })
})

describe("quoteFromRange", () => {
  const html = p("The first paragraph of the post.", "A second one, which is longer than thirty two characters.")

  it("stores the selection with up to 32 characters of context on each side", () => {
    const critique = critiqueOn(html, "c1", "second one")
    expect(critique.config.quote).toEqual({
      exact: "second one",
      prefix: "The first paragraph of the post.\nA ".slice(-32),
      suffix: ", which is longer than thirty tw",
      start: offsetOf(html, "second one")
    })
  })

  it("separates blocks with line breaks", () => {
    const doc = docFromHtml(html)
    const { positions } = textIndex(doc)
    const quote = quoteFromRange(doc, positions[offsetOf(html, "post.")], positions[offsetOf(html, "A second")] + 8)

    expect(quote.exact).toBe("post.\nA second")
  })

  it("is null for a selection without text", () => {
    const doc = docFromHtml(p("abc"))
    expect(quoteFromRange(doc, 0, 1)).toBeNull()
  })
})

describe("projectCritiques", () => {
  it("uses the stored positions on the critique's own version", () => {
    const html = p("Alpha beta gamma.")
    const critique = critiqueOn(html, "v1", "beta")
    const [projected] = projectCritiques(html, [critique], "v1")

    expect(projected.anchor).toEqual({ from: critique.config.from, to: critique.config.to, match: "exact" })
    expect(textAt(html, projected.anchor)).toBe("beta")
  })

  it("keeps the critique's other fields", () => {
    const html = p("Alpha beta gamma.")
    const critique = { ...critiqueOn(html, "v1", "beta"), title: "Not convinced", author: "bob" }

    expect(projectCritiques(html, [critique], "v1")[0]).toMatchObject({ title: "Not convinced", author: "bob" })
  })

  it("marks critiques without a quote as removed on other versions", () => {
    const [projected] = projectCritiques(p("x"), [{ config: { commit: "old", from: 1, to: 2 } }], "new")
    expect(projected.anchor).toEqual({ match: "removed" })
  })

  describe("following a passage through the versions in between", () => {
    it("moves it along when text is added before it", () => {
      const v1 = p("The claim is that taxes should fall.")
      const v2 = p("Intro paragraph.", "Indeed, the claim is that taxes should fall.")
      const critique = critiqueOn(v1, "v1", "taxes should fall")

      const [projected] = projectThrough([["v1", v1], ["v2", v2]], [critique])

      expect(projected.anchor.match).toBe("exact")
      expect(textAt(v2, projected.anchor)).toBe("taxes should fall")
    })

    it("marks it fuzzy when its words changed", () => {
      const v1 = p("We should lower taxes for everyone this year.")
      const v2 = p("We should lower all the taxes for everyone this year.")
      const critique = critiqueOn(v1, "v1", "lower taxes for everyone")

      const [projected] = projectThrough([["v1", v1], ["v2", v2]], [critique])

      expect(projected.anchor.match).toBe("fuzzy")
      expect(textAt(v2, projected.anchor)).toBe("lower all the taxes for everyone")
    })

    it("marks it removed when most of it is gone", () => {
      const v1 = p("Keep this.", "This whole sentence will be deleted soon.", "And this.")
      const v2 = p("Keep this.", "And this.")
      const critique = critiqueOn(v1, "v1", "This whole sentence will be deleted soon.")

      const [projected] = projectThrough([["v1", v1], ["v2", v2]], [critique])

      expect(projected.anchor).toEqual({ match: "removed" })
    })

    it("marks it removed when only a few of its words survive", () => {
      const v1 = p("Start. Alpha beta gamma delta epsilon zeta. End.")
      const v2 = p("Start. Alpha omega. End.")
      const critique = critiqueOn(v1, "v1", "Alpha beta gamma delta epsilon zeta.")

      const [projected] = projectThrough([["v1", v1], ["v2", v2]], [critique])

      expect(projected.anchor).toEqual({ match: "removed" })
    })

    it("keeps the whole passage when a repeated word right after it is deleted", () => {
      // The diff reads this as the passage losing its last word, the next "down" taking its place
      const v1 = p("taxes should go down down soon")
      const v2 = p("Honestly taxes should go down soon")
      const critique = critiqueOn(v1, "v1", "taxes should go down")

      const [projected] = projectThrough([["v1", v1], ["v2", v2]], [critique])

      expect(projected.anchor.match).toBe("exact")
      expect(textAt(v2, projected.anchor)).toBe("taxes should go down")
    })

    it("keeps it removed even when a later version brings similar text back", () => {
      const v1 = p("Opening.", "The disputed sentence about the budget.", "Closing.")
      const v2 = p("Opening.", "Closing.")
      const v3 = p("Opening.", "The disputed sentence about the budget.", "Closing.")
      const critique = critiqueOn(v1, "v1", "The disputed sentence about the budget.")

      const [projected] = projectThrough([["v1", v1], ["v2", v2], ["v3", v3]], [critique])

      expect(projected.anchor).toEqual({ match: "removed" })
    })

    it("tells repeated passages apart", () => {
      const v1 = p(LOREM, LOREM, LOREM)
      const v2 = p("New first paragraph.", LOREM, LOREM, LOREM)
      const critique = critiqueOn(v1, "v1", "dolor sit amet", 1)

      const [projected] = projectThrough([["v1", v1], ["v2", v2]], [critique])

      expect(projected.anchor.match).toBe("exact")
      expect(textAt(v2, projected.anchor)).toBe("dolor sit amet")
      // The second Lorem of v1 is the third paragraph of v2
      const start = textIndex(docFromHtml(v2)).positions.indexOf(projected.anchor.from)
      expect(start).toBe(offsetOf(v2, "dolor sit amet", 1))
    })

    it("keeps the passage, not a neighbouring copy, when a copy right after it is deleted", () => {
      const v1 = p(`${LOREM} ${LOREM} ${LOREM}`)
      const v2 = p(`${LOREM} ${LOREM}`)
      const critique = critiqueOn(v1, "v1", LOREM, 1)

      const [projected] = projectThrough([["v1", v1], ["v2", v2]], [critique])

      expect(projected.anchor.match).toBe("exact")
      expect(textAt(v2, projected.anchor)).toBe(LOREM)
    })

    it("follows passages spanning paragraphs", () => {
      const v1 = p("End of the first paragraph.", "Start of the second one.")
      const v2 = p("A new opening.", "End of the first paragraph.", "Start of the second one.")
      const critique = critiqueOn(v1, "v1", "first paragraph.\nStart of")

      const [projected] = projectThrough([["v1", v1], ["v2", v2]], [critique])

      expect(projected.anchor.match).toBe("exact")
      expect(textAt(v2, projected.anchor)).toBe("first paragraph.\nStart of")
    })

    it("projects several critiques made on different versions at once", () => {
      const v1 = p("One two three four five.")
      const v2 = p("One two three four five six.")
      const v3 = p("Zero. One two three four five six.")
      const critiques = [critiqueOn(v1, "v1", "two three"), critiqueOn(v2, "v2", "five six"), critiqueOn(v3, "v3", "Zero")]

      const projected = projectThrough([["v1", v1], ["v2", v2], ["v3", v3]], critiques)

      expect(projected.map(critique => textAt(v3, critique.anchor))).toEqual(["two three", "five six", "Zero"])
    })

    it("searches for the quote when the stored offsets don't match the original text", () => {
      const v1 = p("Alpha beta gamma delta.")
      const v2 = p("Intro.", "Alpha beta gamma delta.")
      const critique = critiqueOn(v1, "v1", "gamma")
      critique.config.quote.start = 0

      const [projected] = projectThrough([["v1", v1], ["v2", v2]], [critique])

      expect(textAt(v2, projected.anchor)).toBe("gamma")
    })
  })

  describe("searching for the quote, without the versions in between", () => {
    const project = (newHtml, critique) => projectCritiques(newHtml, [critique], "new")[0].anchor

    it("finds the exact text, preferring the occurrence whose context matches", () => {
      const old = p("Cats are great. Dogs are great.")
      const critique = critiqueOn(old, "old", "are great", 1)
      const now = p("Birds are great. Cats are great. Dogs are great.")

      const anchor = project(now, critique)

      expect(anchor.match).toBe("exact")
      expect(docFromHtml(now).textBetween(anchor.from - 5, anchor.from)).toBe("Dogs ")
    })

    it("finds an edited passage between its intact context", () => {
      const old = p("The first sentence stays here. The middle part gets rewritten. The last sentence stays as well.")
      const critique = critiqueOn(old, "old", "The middle part gets rewritten.")
      const now = p("The first sentence stays here. Something entirely different now. The last sentence stays as well.")

      const anchor = project(now, critique)

      expect(anchor.match).toBe("fuzzy")
      expect(textAt(now, anchor)).toBe("Something entirely different now.")
    })

    it("finds a lightly edited passage approximately when its context changed too", () => {
      const old = p("Old intro. The government should invest in public transport. Old outro.")
      const critique = critiqueOn(old, "old", "The government should invest in public transport.")
      const now = p("Brand new opening! The government should invest in public transit. Totally new ending!")

      const anchor = project(now, critique)

      expect(anchor.match).toBe("fuzzy")
      expect(textAt(now, anchor)).toContain("The government should invest in public trans")
    })

    it("gives up on a passage that's gone", () => {
      const old = p("Some sentence about the economy.")
      const critique = critiqueOn(old, "old", "about the economy")

      expect(project(p("Nothing related at all, really."), critique)).toEqual({ match: "removed" })
    })

    it("doesn't match short quotes approximately", () => {
      const old = p("Yes it is.")
      const critique = critiqueOn(old, "old", "Yes")

      expect(project(p("Ye, is it?"), critique)).toEqual({ match: "removed" })
    })

    it("is used when a lineage is incomplete", () => {
      const v1 = p("Alpha beta gamma.")
      const v3 = p("Intro. Alpha beta gamma.")
      const critique = critiqueOn(v1, "v1", "beta")

      // v2's text is missing
      const [projected] = projectCritiques(v3, [critique], "v3", { v1 }, { v1: ["v1", "v2", "v3"] })

      expect(projected.anchor.match).toBe("exact")
      expect(textAt(v3, projected.anchor)).toBe("beta")
    })
  })
})

describe("critiques on charts", () => {
  const nodeAt = (html, { from }) => docFromHtml(html).nodeAt(from)

  it("quotes a chart as its stand-in character, with the text around it as context", () => {
    const html = p("Spending grew every year.") + chart() + p("As the chart shows.")
    const critique = critiqueOn(html, "v1", CHART_TEXT)

    expect(critique.config.quote).toMatchObject({ exact: CHART_TEXT, prefix: "Spending grew every year.\n", suffix: "\nAs the chart shows." })
    expect(critique.config.to - critique.config.from).toBe(1)
    expect(nodeAt(html, critique.config).type.name).toBe("chart")
  })

  it("quotes a chart at the very start of the post", () => {
    const html = chart() + p("After it.")
    const critique = critiqueOn(html, "v1", CHART_TEXT)

    expect(critique.config.from).toBe(0)
    expect(critique.config.quote.exact).toBe(CHART_TEXT)
  })

  it("follows a chart when text is added around it", () => {
    const v1 = p("Spending grew every year.") + chart() + p("As the chart shows.")
    const v2 = p("A new opening paragraph.", "Spending grew every single year.") + chart() + p("As the chart clearly shows.")
    const [projected] = projectThrough([["v1", v1], ["v2", v2]], [critiqueOn(v1, "v1", CHART_TEXT)])

    expect(projected.anchor.match).toBe("exact")
    expect(nodeAt(v2, projected.anchor).type.name).toBe("chart")
  })

  it("follows the criticised chart, not another one, when an earlier chart is removed", () => {
    const v1 = p("First data.") + chart("A") + p("Second data.") + chart("B") + p("End.")
    const v2 = p("First data.", "Second data.") + chart("B") + p("End.")
    const [projected] = projectThrough([["v1", v1], ["v2", v2]], [critiqueOn(v1, "v1", CHART_TEXT, 1)])

    expect(nodeAt(v2, projected.anchor).attrs.data).toContain("'B'")
  })

  it("marks a critique as removed when its chart is removed", () => {
    const v1 = p("Spending grew every year.") + chart() + p("As the chart shows.")
    const v2 = p("Spending grew every year.", "As the chart shows.")
    const [projected] = projectThrough([["v1", v1], ["v2", v2]], [critiqueOn(v1, "v1", CHART_TEXT)])

    expect(projected.anchor).toEqual({ match: "removed" })
  })

  it("finds the chart by its context without the versions in between", () => {
    const v1 = p("Spending grew every year.") + chart() + p("As the chart shows.")
    const v2 = p("Something new.", "Spending grew every year.") + chart() + p("As the chart shows.")
    const [projected] = projectCritiques(v2, [critiqueOn(v1, "v1", CHART_TEXT)], "v2")

    expect(projected.anchor.match).toBe("exact")
    expect(nodeAt(v2, projected.anchor).type.name).toBe("chart")
  })
})
