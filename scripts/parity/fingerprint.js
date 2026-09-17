/**
 * The design fingerprint: a normalised description of what a page looks like.
 *
 * The same function runs against both the artboard and the live app, so the
 * two are described in identical terms even though their markup has nothing in
 * common. Everything downstream is a diff of two of these.
 *
 * What it captures is the whole design of this harness. Two failure modes bound
 * the choice:
 *
 *   Too strict — include data-bearing text, image URLs, list lengths — and a
 *   report of 4,000 findings arrives, of which ~12 are real. Nobody reads that
 *   report, so the loop never terminates.
 *
 *   Too loose — compare only colours and fonts — and it reports parity on a
 *   page that is missing half its sections.
 *
 * So: capture *form* (which sections exist, in what order, set in what type, at
 * what scale) and ignore *content* (which five toys came back from the
 * database). The one exception is prose copy on static pages, where the words
 * are the design — see `copy` below.
 */

/** Serialised into the page by run.js. Must be self-contained. */
function collectFingerprint(rootSelector) {
  const root = document.querySelector(rootSelector) || document.body
  const cs = (el) => getComputedStyle(el)

  const norm = (s) =>
    (s || '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase()
      // Numbers are data: "12 guides" and "148 guides" are the same design.
      .replace(/\d[\d,.]*/g, '#')

  const px = (v) => Math.round(parseFloat(v) || 0)

  // Colours arrive as rgb()/rgba() from both sides; compare as-is but drop a
  // fully-opaque alpha so rgb(1,2,3) and rgba(1,2,3,1) match.
  const colour = (v) => (v || '').replace(/,\s*1\)$/, ')').replace(/\s+/g, '')

  const visible = (el) => {
    const r = el.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) return false
    const s = cs(el)
    return s.visibility !== 'hidden' && s.display !== 'none' && s.opacity !== '0'
  }

  // ---- headings -----------------------------------------------------------
  // The strongest signal available: every screen has them, they carry the type
  // ramp, and their text is stable enough to match nodes across two DOMs.
  //
  // Matched VISUALLY, not by tag. The board sets its section doors as styled
  // divs where live uses <h3>; tag-based matching reported five false
  // `extra-section` findings on /about alone for text that renders identically
  // on both sides. What matters for parity is what the reader sees is a
  // heading, so anything set large-and-bold over a short text run counts, and
  // the semantic level is recorded separately rather than used for matching.
  const HEADING_MIN_SIZE = 17
  const HEADING_MIN_WEIGHT = 600

  const headingLike = (el) => {
    const s = cs(el)
    // A semantic heading is a heading at any size. Live sets its section-door
    // h3s at 14px where the board sets them larger; gating those on size
    // dropped them from the live side and the matcher then reported four
    // present-and-correct sections as missing. The size difference is real, but
    // it is a `size` finding — not a missing section.
    const semantic = /^H[1-6]$/.test(el.tagName)
    if (!semantic && px(s.fontSize) < HEADING_MIN_SIZE) return false
    if (!semantic && +s.fontWeight < HEADING_MIN_WEIGHT) return false
    const t = (el.innerText || '').trim()
    if (t.length < 2 || t.length > 90) return false
    // Own text only: a bold wrapper should not masquerade as its own heading.
    const ownText = [...el.childNodes]
      .filter((n) => n.nodeType === 3)
      .map((n) => n.textContent.trim())
      .join('')
    return ownText.length > 1 || /^H[1-6]$/.test(el.tagName)
  }

  const seenText = new Set()
  const headings = [...root.querySelectorAll('h1,h2,h3,h4,div,span,p,dt,strong,button,a')]
    .filter(visible)
    .filter(headingLike)
    .map((h) => {
      const s = cs(h)
      const size = px(s.fontSize)
      return {
        // Semantic level where there is one, else inferred from scale so the
        // two sides are comparable at all.
        level: /^H([1-6])$/.test(h.tagName)
          ? +h.tagName[1]
          : size >= 40 ? 1 : size >= 26 ? 2 : size >= 20 ? 3 : 4,
        tag: h.tagName,
        text: norm(h.innerText).slice(0, 80),
        font: s.fontFamily.split(',')[0].replace(/["']/g, '').trim(),
        size,
        weight: +s.fontWeight,
        colour: colour(s.color),
      }
    })
    .filter((h) => {
      if (!h.text || seenText.has(h.text)) return false
      seenText.add(h.text)
      return true
    })

  // ---- component inventory ------------------------------------------------
  // Counts catch a dropped section; shape catches a card with the wrong radius
  // or a button that lost its shadow.
  //
  // The MOST COMMON value across every instance, not the first one. Which
  // element happens to be first is an accident of document order and differs
  // between the two sides — comparing firsts reported a white board button
  // against a blue live button when both sides had one of each. The modal value
  // is what the page reads as, and is what a wrong radius actually shows up in.
  const modal = (values) => {
    const counts = new Map()
    for (const v of values) counts.set(v, (counts.get(v) || 0) + 1)
    let best = null, n = 0
    for (const [v, c] of counts) if (c > n) { best = v; n = c }
    // A "most common" value that only a third of instances share is describing
    // a mixed population, not the design. Report nothing rather than a number
    // that looks authoritative and is not.
    return values.length >= 3 && n / values.length < 0.34 ? null : best
  }

  const shapeOf = (els) => {
    if (!els || !els.length) return null
    const S = els.map(cs)
    return {
      radius: modal(S.map((s) => px(s.borderTopLeftRadius))),
      shadow: modal(S.map((s) => (s.boxShadow === 'none' ? 'none' : 'set'))),
      bg: modal(S.map((s) => colour(s.backgroundColor))),
      padY: modal(S.map((s) => px(s.paddingTop))),
      padX: modal(S.map((s) => px(s.paddingLeft))),
      border: modal(S.map((s) => (s.borderTopWidth === '0px' ? 'none' : px(s.borderTopWidth) + 'px'))),
      n: els.length,
    }
  }

  const pick = (sel) => [...root.querySelectorAll(sel)].filter(visible)

  // Cards are named differently on each side, so identify them structurally:
  // a block with a radius and either a shadow or a border.
  const cards = pick('div,article,li,section').filter((el) => {
    const s = cs(el)
    const r = parseFloat(s.borderTopLeftRadius) || 0
    if (r < 8) return false
    const rect = el.getBoundingClientRect()
    if (rect.height < 60 || rect.width < 80) return false
    return s.boxShadow !== 'none' || parseFloat(s.borderTopWidth) > 0
  })

  const candidates = pick('button,[role="button"],a[class*="btn"],a[class*="button"]')

  // The PRIMARY action button, not "all buttons".
  //
  // A modal across everything tagged <button> describes whichever kind is most
  // numerous, and the two sides do not agree on what a button is: the board
  // renders the Learn course nav as fifteen <button> rows with no background,
  // so "the board's button" came back as a flat transparent row and every Learn
  // screen reported a false radius and shadow difference against live's pill
  // CTA. The primary action is well-defined on both sides — it is the one with
  // a filled, non-neutral background — so that is what gets compared.
  const NEUTRAL = new Set([
    'rgba(0,0,0,0)',
    'transparent',
    'rgb(255,255,255)',
    colour(cs(document.body).backgroundColor),
  ])
  // Among filled buttons, the primary action is the darkest: a brand fill sits
  // well below a brand *tint*, and the board highlights the current Learn nav
  // row with the lightest tint in the palette. Picking by "non-neutral" alone
  // tied that row against the real CTA and the row won.
  const lum = (c) => {
    const m = /rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/.exec(c)
    return m ? 0.2126 * +m[1] + 0.7152 * +m[2] + 0.0722 * +m[3] : 255
  }
  const filled = candidates.filter((el) => !NEUTRAL.has(colour(cs(el).backgroundColor)))
  const darkest = filled.length
    ? filled.reduce((a, b) => (lum(cs(a).backgroundColor) <= lum(cs(b).backgroundColor) ? a : b))
    : null
  // Every button sharing the primary's fill — so the shape is still a modal
  // over a homogeneous set rather than one arbitrary element.
  const buttons = darkest
    ? filled.filter(
        (el) => colour(cs(el).backgroundColor) === colour(cs(darkest).backgroundColor)
      )
    : []
  const inputs = pick('input,select,textarea')

  // ---- prose copy ---------------------------------------------------------
  // Only on pages without data: there, the words ARE the design, and the board
  // saying "No paid tier, ever" where live says "Why this exists" is a real
  // finding. Capped so a long article does not dominate the diff.
  const paragraphs = pick('p')
    .map((p) => norm(p.innerText))
    .filter((t) => t.length > 25)
    .slice(0, 40)

  return {
    headings,
    counts: {
      cards: cards.length,
      buttons: buttons.length,
      inputs: inputs.length,
      images: pick('img').length,
      tables: pick('table').length,
      lists: pick('ul,ol').length,
    },
    shapes: {
      card: shapeOf(cards),
      button: shapeOf(buttons),
      input: shapeOf(inputs),
    },
    paragraphs,
    page: {
      height: Math.round(root.getBoundingClientRect().height),
      canvas: colour(cs(document.body).backgroundColor),
      ink: colour(cs(document.body).color),
      bodyFont: cs(document.body).fontFamily.split(',')[0].replace(/["']/g, '').trim(),
    },
  }
}

module.exports = { collectFingerprint }
