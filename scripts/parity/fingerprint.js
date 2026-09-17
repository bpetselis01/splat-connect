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

  // Cards are detected before headings because a heading needs to know whether
  // it sits inside one — see `inCard` below.
  //
  // `a` included: a clickable card is a Link, which renders as an anchor, and
  // leaving it out made every listing grid report "board has cards, live has
  // none" while live was showing fifty of them.
  const cardEls = [...root.querySelectorAll('div,article,li,section,a')].filter((el) => {
    const st = cs(el)
    const r = parseFloat(st.borderTopLeftRadius) || 0
    if (r < 8) return false
    const rect = el.getBoundingClientRect()
    if (rect.height < 60 || rect.width < 80) return false
    if (rect.width < 2 || rect.height < 2) return false
    return st.boxShadow !== 'none' || parseFloat(st.borderTopWidth) > 0
  })
  // Leaf-most only: a bordered box that CONTAINS another bordered box is a
  // container, not a card. Keeping both made the grid wrapper on /library the
  // "card" whose radius and title got measured — reporting the page's own 36px
  // h1 as the card title and the wrapper's 24px as the card radius, while the
  // nineteen actual toy cards went unmeasured.
  const leafCards = cardEls.filter((el) => !cardEls.some((o) => o !== el && el.contains(o)))
  cardEls.length = 0
  cardEls.push(...leafCards)
  const cardSet = new Set(cardEls)

  /*
   * Is this heading the title of a RECORD rather than a piece of page chrome?
   *
   * Two signals, because one was not enough. Sitting inside a card catches
   * grids; it misses a leaderboard, whose rows carry no border or shadow and so
   * are not cards. /impact reported twelve missing sections that were simply
   * the board's sample contributors ("Rachel Kaur", "Northside Therapy")
   * against live's fixtures.
   *
   * The second signal is repetition: an element whose parent has siblings of
   * the same shape is one row of a list, and a list is data. Comparing those by
   * text compares fixtures, which this report ignores everywhere else.
   */
  const shapeKey = (el) => el.tagName + '.' + (el.className || '').toString().trim()
  // A row, not a page section. Three constraints, each earned:
  //   - at most five levels up, because a record's title sits inside its row
  //     but can be a few wrappers deep inside it;
  //   - the repeated element is a list item, table row, link, or a div with a
  //     class — a page's five bare <section> siblings are not a list, and
  //     counting them as one made /printing/basics report the "Which filament"
  //     heading missing seconds after it was added;
  //   - three or more of them, so a two-column layout is not a list either.
  const ROW_TAGS = new Set(['LI', 'TR', 'A', 'BUTTON', 'ARTICLE'])
  const rowish = (el) =>
    ROW_TAGS.has(el.tagName) || (el.className || '').toString().trim().length > 0
  const inRepeatedRow = (el) => {
    let depth = 0
    for (let n = el; n && n !== root && depth < 5; n = n.parentElement, depth++) {
      const parent = n.parentElement
      if (!parent || !rowish(n)) continue
      const key = shapeKey(n)
      let same = 0
      for (const sib of parent.children) if (shapeKey(sib) === key) same++
      if (same >= 3) return true
    }
    return false
  }

  const insideCard = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) if (cardSet.has(n)) return true
    return inRepeatedRow(el)
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
        // A heading inside a card is the title of a RECORD — "Bubble machine",
        // "Weighted lap snake". The board shows six samples and live shows
        // whatever is in the database, so matching these by text compares
        // fixtures, not design. Tagged here and compared by shape rather than
        // wording in compare.js.
        inCard: insideCard(h),
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

  /*
   * The title of each card, found by prominence rather than by threshold.
   *
   * Relying on "is it heading-like" to spot a record title begs the question:
   * live sets its toy-card titles at 14px/700, which is below any sensible
   * heading threshold — so they vanished from the fingerprint and the report
   * said "board lists records, live shows none" of a page showing nineteen
   * toys. Being too small IS the finding, so the title has to be identified
   * structurally and then measured, never identified BY its measurements.
   *
   * Prominence = the largest own-text descendant, earliest wins a tie.
   */
  const titleOf = (card) => {
    let best = null
    for (const el of card.querySelectorAll('*')) {
      // A control nested INSIDE the card is not its title — in a card of small
      // text with a prominent button, "largest text" elected the button.
      //
      // Nested, not merely "inside a control": the board renders most of its
      // cards AS buttons, so excluding everything under a button excluded the
      // entire card and elected a 14px byline as the title on every listing
      // screen.
      const ctrl = el.closest('button,[role="button"],a[class*="btn"]')
      if (ctrl && ctrl !== card && card.contains(ctrl)) continue
      // No position constraint. "A title sits near the top of its card" is true
      // of a text card and false of a photo card, where the image takes the top
      // two thirds and the title sits under it — requiring the top 60% elected
      // the 12px eyebrow badge overlaid on the photo instead, on every listing
      // screen.
      const own = [...el.childNodes]
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim())
        .join('')
      if (own.length < 2) continue
      // Must contain actual words. CardPhoto's 🧸 placeholder is set at
      // text-4xl, making it the largest "text" in every photo-less card — so
      // the card title measured 36px/400 on every listing screen and the report
      // blamed the design for an emoji.
      if (!/[\p{L}\p{N}]{2}/u.test(own)) continue
      if (!visible(el)) continue
      const st = cs(el)
      const size = px(st.fontSize)
      if (!best || size > best.size) {
        best = { size, weight: +st.fontWeight, font: st.fontFamily.split(',')[0].replace(/["']/g, '').trim() }
      }
    }
    return best
  }

  // Cards are named differently on each side, so identify them structurally:
  // a block with a radius and either a shadow or a border.
  // Disabled controls excluded. A form's submit starts disabled on most of
  // these screens, and .btn:disabled drops the shadow deliberately — so
  // comparing it against the board, which draws the enabled state, reported
  // "no button on live carries a shadow" on 28 screens for a state difference
  // rather than a design one.
  const candidates = pick('button,[role="button"],a[class*="btn"],a[class*="button"]').filter(
    (el) => !el.disabled && el.getAttribute('aria-disabled') !== 'true'
  )

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

  const cardTitles = cardEls.map(titleOf).filter(Boolean)

  return {
    headings,
    cardTitles,
    counts: {
      cards: cardEls.length,
      buttons: buttons.length,
      inputs: inputs.length,
      images: pick('img').length,
      tables: pick('table').length,
      lists: pick('ul,ol').length,
    },
    shapes: {
      card: shapeOf(cardEls),
      button: shapeOf(buttons),
      input: shapeOf(inputs),
    },
    // The SET of styles each control kind appears in, not one elected
    // representative.
    //
    // Electing a representative kept picking different things on the two
    // sides — "darkest filled" chose the board's brand CTA against live's
    // ink-coloured button — and then reported the mismatch it had created. A
    // set comparison asks the question that actually matters: does live have
    // ANY button with the shadow the board gives its primary? That is robust
    // to the two sides ordering, colouring and counting their buttons
    // differently, which they always do.
    sets: {
      buttonRadius: [...new Set(candidates.map((e) => px(cs(e).borderTopLeftRadius)))].sort(
        (a, b) => a - b
      ),
      buttonShadow: [
        ...new Set(candidates.map((e) => (cs(e).boxShadow === 'none' ? 'none' : 'set'))),
      ].sort(),
      inputRadius: [...new Set(inputs.map((e) => px(cs(e).borderTopLeftRadius)))].sort(
        (a, b) => a - b
      ),
      inputBg: [...new Set(inputs.map((e) => colour(cs(e).backgroundColor)))].sort(),
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
