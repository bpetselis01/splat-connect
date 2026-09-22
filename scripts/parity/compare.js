/**
 * Diff two fingerprints into typed findings. Pure — no browser, no I/O — so it
 * can be reasoned about and unit-tested on fixtures.
 *
 * Every finding carries both observed values, because a finding you have to
 * re-derive to act on is a finding that gets skipped.
 */

/** Sizes within this many px are the same decision rendered slightly differently. */
const SIZE_TOLERANCE = 2
/** Page heights legitimately differ with real data; only flag gross mismatch. */
const HEIGHT_RATIO = 0.45

const SEV = { high: 3, medium: 2, low: 1 }

function f(type, severity, what, board, live, extra) {
  return { type, severity, what, board, live, ...(extra || {}) }
}

/**
 * Match headings across two DOMs.
 *
 * Text first — it survives completely different markup, which selectors do not.
 * Falling back to ordinal-within-level keeps a heading matched when the copy
 * was deliberately changed, so a copy edit reports as one `copy` finding rather
 * than a spurious missing+extra pair.
 *
 * `boardAll`/`liveAll` include the headings `inCard` filtered out of the two
 * chrome lists, and exist because that flag is not symmetric. The same section
 * heading is inCard on one side and not on the other whenever one side happens
 * to wrap it in a card — live's lesson pages do, the board's do not. Matching
 * only chrome-to-chrome reported all three of /learn/safe-handling's sections
 * as missing while they were on screen, and the board's own card-wrapped
 * "Feedback" as an extra live section. Text carries across the boundary; only
 * the record-title comparison depends on the flag.
 */
function matchHeadings(board, live, liveAll, boardAll) {
  const pairs = []
  const usedLive = new Set()
  const liveByText = new Map()
  live.forEach((h, i) => {
    if (!liveByText.has(h.text)) liveByText.set(h.text, i)
  })

  for (const b of board) {
    const i = liveByText.get(b.text)
    if (i !== undefined && !usedLive.has(i)) {
      usedLive.add(i)
      pairs.push([b, live[i]])
    } else pairs.push([b, null])
  }

  // Same text, wrapped in a card on the live side only. A counterpart, and
  // compared on how it is set — but never on wording, which is equal by
  // construction here.
  const usedCross = new Set()
  for (const pair of pairs) {
    if (pair[1]) continue
    const j = (liveAll || []).findIndex(
      (h, i) => h.inCard && h.text === pair[0].text && !usedCross.has(i)
    )
    if (j !== -1) {
      usedCross.add(j)
      pair[1] = liveAll[j]
      pair[2] = 'card'
    }
  }

  // Second pass: ordinal-within-level for board headings still unmatched.
  for (const pair of pairs) {
    if (pair[1]) continue
    const b = pair[0]
    const sameLevelBoard = board.filter((x) => x.level === b.level)
    const rank = sameLevelBoard.indexOf(b)
    const candidates = live.filter((x, i) => x.level === b.level && !usedLive.has(i))
    const cand = candidates[Math.min(rank, candidates.length - 1)]
    if (cand) {
      usedLive.add(live.indexOf(cand))
      pair[1] = cand
      pair[2] = 'ordinal'
    }
  }

  // The mirror of the cross-card pass: a live chrome heading whose words are on
  // the board too, inside one of the board's cards, is not an extra section.
  const boardText = new Set((boardAll || board).map((h) => h.text))
  const extras = live.filter((h, i) => !usedLive.has(i) && !boardText.has(h.text))
  return { pairs, extras }
}

function compare(board, live, opts = {}) {
  const out = []
  const allowCopy = opts.copy !== false

  // ---- typography --------------------------------------------------------
  //
  // Split first. A heading inside a card titles a RECORD, and the two sides
  // hold different records by design: the board draws six sample toys, live
  // renders the fifty in the database. Matching those by text compared
  // fixtures and reported "Bubble machine has no counterpart" as a design
  // defect 300-odd times. Record titles are compared by how they are SET —
  // font, size, weight — which is the part the design actually specifies.
  const chrome = (hs) => hs.filter((h) => !h.inCard)
  const records = (hs) => hs.filter((h) => h.inCard)

  const { pairs, extras } = matchHeadings(
    chrome(board.headings),
    chrome(live.headings),
    live.headings,
    board.headings
  )

  // Card titles, measured structurally (see titleOf in fingerprint.js) so that
  // "live sets these too small to read as titles" surfaces as a size finding
  // rather than as a phantom missing section.
  //
  // Only when BOTH sides elected something that actually looks like a title.
  // "The largest text in the card" identifies a title well on a text card and
  // badly elsewhere: on the board's listing screens it elected a 12px eyebrow
  // badge, a 13px byline and a 15px button in turn, each time reporting a
  // confident difference against live's real 18px title. If what was elected is
  // body-sized, there is no title here to compare and the honest output is
  // nothing.
  const TITLE_MIN = 15
  const bT = (board.cardTitles || []).filter((t) => t.size >= TITLE_MIN)
  const lT = (live.cardTitles || []).filter((t) => t.size >= TITLE_MIN)
  if (bT.length && lT.length) {
    // Null on a dead heat, for the reason fingerprint.js's modal() gives.
    const modeOf = (xs, key) => {
      const c = new Map()
      for (const x of xs) c.set(x[key], (c.get(x[key]) || 0) + 1)
      const top = [...c.entries()].sort((a, b) => b[1] - a[1])
      return top.length > 1 && top[0][1] === top[1][1] ? null : top[0][0]
    }
    // Mode against SET, the same way the buttons are compared, and for the
    // same reason. A screen's cards are not one population: /impact draws four
    // stat tiles with 44px numbers beside its record cards, and which kind wins
    // the mode flips with how many records the side happens to hold — six
    // samples on the board, fifty rows live. That reported "card title 44px vs
    // 17px" on a screen where both sides draw both sizes, and flipped Baloo
    // against Nunito in both directions across eleven screens. The question
    // worth asking is whether live has ANY card title the board's shape.
    const bf = modeOf(bT, 'font')
    if (bf != null && !lT.some((t) => t.font === bf))
      out.push(f('font', 'high', 'card title font', bf, modeOf(lT, 'font')))
    const bs = modeOf(bT, 'size')
    if (bs != null && !lT.some((t) => Math.abs(t.size - bs) <= SIZE_TOLERANCE))
      out.push(f('size', 'medium', 'card title size', bs + 'px', modeOf(lT, 'size') + 'px'))
    const bw = modeOf(bT, 'weight')
    if (bw != null && !lT.some((t) => Math.abs(t.weight - bw) < 100))
      out.push(f('weight', 'low', 'card title weight', bw, modeOf(lT, 'weight')))
  } else if (board.counts.cards > 2 && live.counts.cards === 0) {
    out.push(
      f('missing-section', 'high', 'board lists cards, live shows none', board.counts.cards, 0)
    )
  }

  for (const [b, l, via] of pairs) {
    if (!l) {
      out.push(
        f('missing-section', 'high', `h${b.level} "${b.text}" has no counterpart`, b.text, null)
      )
      continue
    }
    const where = `h${b.level} "${b.text}"`
    if (b.font !== l.font) out.push(f('font', 'high', `${where} font`, b.font, l.font))
    if (Math.abs(b.size - l.size) > SIZE_TOLERANCE)
      out.push(f('size', 'medium', `${where} size`, b.size + 'px', l.size + 'px'))
    if (Math.abs(b.weight - l.weight) >= 100)
      out.push(f('weight', 'low', `${where} weight`, b.weight, l.weight))
    if (b.colour !== l.colour) out.push(f('colour', 'low', `${where} colour`, b.colour, l.colour))
    const isRecordTitle = opts.recordTitleH1 && b.level === 1
    if (via === 'ordinal' && allowCopy && !isRecordTitle && b.text !== l.text)
      out.push(f('copy', 'medium', `h${b.level} wording`, b.text, l.text))
  }

  // Collapsed per level.
  //
  // The board draws a listing screen with six sample cards; live renders the
  // fifty rows actually in the database. Reporting each of the extra
  // forty-four separately produced 56 findings on /library for a single fact —
  // the same data-volume difference the fingerprint deliberately ignores
  // everywhere else — and drowned the four real findings on that screen.
  const extrasByLevel = new Map()
  for (const e of extras) {
    if (!extrasByLevel.has(e.level)) extrasByLevel.set(e.level, [])
    extrasByLevel.get(e.level).push(e.text)
  }
  const boardHasLevel = new Set(board.headings.map((h) => h.level))
  for (const [level, texts] of extrasByLevel) {
    // The board's artboard sections do not all contain their own page title —
    // several screens are anchored on the content block, with the <h1> drawn in
    // a sibling section outside data-screen-label. Live's <main> always has it,
    // so it read as "an extra h1" on every such screen. If the board draws
    // nothing at this level at all, the level is out of the section's scope
    // rather than absent from the design.
    if (!boardHasLevel.has(level)) continue
    out.push(
      f(
        'extra-section',
        texts.length > 3 ? 'low' : 'medium',
        texts.length === 1
          ? `live has an extra h${level}: "${texts[0]}"`
          : `live has ${texts.length} extra h${level} the board does not draw`,
        null,
        texts.slice(0, 3).join(' | ')
      )
    )
  }

  // ---- control style sets -------------------------------------------------
  // Asked as "does live offer this at all", which survives the two sides
  // ordering and counting their controls differently.
  if (board.sets && live.sets) {
    const { sets: b } = board
    const { sets: l } = live
    // Only when live actually has an enabled button to judge. A screen whose
    // sole control is a disabled submit has an empty set, and "none of your
    // zero buttons has a shadow" is not a finding.
    // Both sides must actually have a primary button. `buttonShadow` is built
    // over every enabled button, so a form whose submit is correctly disabled
    // until a box is ticked still has a non-empty set — of a password reveal
    // and a skip link, neither of which the board's primary should be judged
    // against.
    const bothPrimary = board.hasPrimary !== false && live.hasPrimary !== false
    if (
      bothPrimary &&
      l.buttonShadow.length &&
      b.buttonShadow.includes('set') &&
      !l.buttonShadow.includes('set')
    )
      out.push(f('shadow', 'medium', 'no button on live carries a shadow', 'set', 'none'))
    if (bothPrimary && b.buttonRadius.length && l.buttonRadius.length) {
      const bMax = Math.max(...b.buttonRadius)
      const lMax = Math.max(...l.buttonRadius)
      if (Math.abs(bMax - lMax) > SIZE_TOLERANCE)
        out.push(f('radius', 'low', 'button radius range', bMax + 'px', lMax + 'px'))
    }
    if (b.inputRadius.length && l.inputRadius.length) {
      const bi = Math.max(...b.inputRadius)
      const li = Math.max(...l.inputRadius)
      if (Math.abs(bi - li) > SIZE_TOLERANCE)
        out.push(f('radius', 'low', 'input radius', bi + 'px', li + 'px'))
    }
    if (b.inputBg.length && l.inputBg.length) {
      const miss = b.inputBg.filter((c) => !l.inputBg.includes(c))
      if (miss.length === b.inputBg.length)
        out.push(f('colour', 'low', 'input background', b.inputBg.join('/'), l.inputBg.join('/')))
    }
  }

  // ---- component shape ---------------------------------------------------
  // Cards, compared modal-against-population rather than modal-against-modal.
  // A screen's cards are not one population — a hero panel, a feature tile and
  // a record card are three shapes, and which one wins the mode depends on how
  // many records the side happens to hold. Modal-against-modal reported card
  // radius 18 vs 24 on five screens and 24 vs 18 on three others, in both
  // directions, for the same two shapes. The answerable question is whether
  // live draws the board's shape on a fair share of its cards.
  //
  // A quarter, not one instance: a single card that happens to match must not
  // silence the check for the other nineteen.
  const SHARE = 0.25
  const share = (vals, pred) =>
    !vals || !vals.length ? 0 : vals.filter(pred).length / vals.length
  for (const kind of ['card']) {
    const b = board.shapes[kind]
    const l = live.shapes[kind]
    if (!b || !l) continue
    const lv = l.values || { radius: [l.radius], shadow: [l.shadow], bg: [l.bg] }
    if (
      b.radius != null &&
      share(lv.radius, (r) => Math.abs(r - b.radius) <= SIZE_TOLERANCE) < SHARE
    )
      out.push(f('radius', 'medium', `${kind} radius`, b.radius + 'px', l.radius + 'px'))
    if (b.shadow != null && share(lv.shadow, (x) => x === b.shadow) < SHARE)
      out.push(f('shadow', 'low', `${kind} shadow`, b.shadow, l.shadow))
    if (b.bg != null && share(lv.bg, (x) => x === b.bg) < SHARE)
      out.push(f('colour', 'low', `${kind} background`, b.bg, l.bg))
    // Card padding is deliberately NOT compared. The two sides put it in
    // different places — the board pads an inner wrapper and leaves the card
    // itself at 0, live pads the card — so the comparison reported 0/0 against
    // 12/12 on fifteen screens and 22/24 against 0/0 on four more, in both
    // directions, for cards that look identical. Measuring where the padding is
    // declared rather than what it does is not worth a finding.
  }

  // ---- site chrome -------------------------------------------------------
  // The header is on every page, so a difference here is 119 screens wrong at
  // once — which is precisely what happened while nothing measured it.
  if (board.chrome && live.chrome) {
    const b = board.chrome
    const l = live.chrome
    if (b.navFont !== l.navFont)
      out.push(f('font', 'high', 'header nav font', b.navFont, l.navFont))
    if (Math.abs(b.navSize - l.navSize) > SIZE_TOLERANCE)
      out.push(f('size', 'high', 'header nav size', b.navSize + 'px', l.navSize + 'px'))
    if (Math.abs(b.navWeight - l.navWeight) >= 100)
      out.push(f('weight', 'medium', 'header nav weight', b.navWeight, l.navWeight))
    if (b.navTransform !== l.navTransform)
      out.push(f('copy', 'high', 'header nav letter case', b.navTransform, l.navTransform))
    if (Math.abs(b.navRadius - l.navRadius) > SIZE_TOLERANCE)
      out.push(f('radius', 'medium', 'header nav pill', b.navRadius + 'px', l.navRadius + 'px'))
  }

  // ---- page-level --------------------------------------------------------
  if (board.page.bodyFont !== live.page.bodyFont)
    out.push(f('font', 'high', 'body font', board.page.bodyFont, live.page.bodyFont))
  if (board.page.canvas !== live.page.canvas)
    out.push(f('colour', 'high', 'canvas', board.page.canvas, live.page.canvas))

  const bh = board.page.height
  const lh = live.page.height
  // Skipped when the two sides hold very different numbers of records: the
  // board draws six sample guides and live renders the four hundred in the
  // database, so /library is legitimately 31,000px against the board's 1,005.
  // That is data volume, which this report ignores everywhere else.
  // A table page has no cards; its records are body rows, and the same skew
  // applies — the board's five queued guides against the queue's hundreds.
  const skew = (b, l) => b > 2 && l > 2 && Math.max(b, l) / Math.min(b, l) > 2
  const volumeSkew =
    skew(board.counts.cards, live.counts.cards) ||
    skew(board.counts.rows || 0, live.counts.rows || 0)
  if (bh > 200 && lh > 200 && !volumeSkew) {
    const ratio = Math.min(bh, lh) / Math.max(bh, lh)
    if (ratio < HEIGHT_RATIO)
      out.push(f('missing-section', 'high', 'page height differs grossly', bh + 'px', lh + 'px'))
  }

  // Structural counts. Cards and images track real data, so only a board that
  // has them against a live page with none is a finding.
  for (const k of ['tables', 'inputs']) {
    const b = board.counts[k]
    const l = live.counts[k]
    if (b > 0 && l === 0) out.push(f('missing-section', 'medium', `no ${k} on live`, b, l))
  }
  if (board.counts.cards > 2 && live.counts.cards === 0)
    out.push(f('missing-section', 'high', 'board has cards, live has none', board.counts.cards, 0))

  // ---- copy --------------------------------------------------------------
  if (allowCopy && board.paragraphs.length) {
    // Word overlap, not string equality. The board's "Review and remove
    // accounts. 57 total, 4 flagged." against live's "Review and remove
    // accounts. 57 total." is the same sentence with a count live does not
    // hold, and exact matching called it 1/1 board paragraphs absent. Three
    // quarters of the words shared is the same paragraph; anything less is
    // copy the page does not carry.
    const words = (t) => new Set(t.split(/\W+/).filter(Boolean))
    const liveWords = live.paragraphs.map(words)
    const same = (p) => {
      const b = words(p)
      if (!b.size) return true
      return liveWords.some((l) => {
        let hit = 0
        for (const w of b) if (l.has(w)) hit++
        return hit / b.size >= 0.75
      })
    }
    const missing = board.paragraphs.filter((p) => !same(p))
    // Only report when MOST of the board's prose is absent: a page whose copy
    // partly matches is being edited, not missing.
    if (missing.length && missing.length / board.paragraphs.length > 0.6)
      out.push(
        f(
          'copy',
          'medium',
          `${missing.length}/${board.paragraphs.length} board paragraphs absent`,
          missing[0]?.slice(0, 70),
          live.paragraphs[0]?.slice(0, 70) ?? null
        )
      )
  }

  out.sort((a, b) => SEV[b.severity] - SEV[a.severity])
  // Pages whose content is not the board's to dictate — the legal set, whose
  // wording and sections belong to counsel (docs/REGULATORY-CHANGES.md), and
  // board screens that draw a STATE the harness cannot load live into, such as
  // /signup (sent). Style is still compared; presence of sections is not.
  if (opts.structure === false)
    return out.filter((x) => x.type !== 'missing-section' && x.type !== 'extra-section')

  return out
}

module.exports = { compare, matchHeadings }
