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
 */
function matchHeadings(board, live) {
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

  const extras = live.filter((_, i) => !usedLive.has(i))
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

  const { pairs, extras } = matchHeadings(chrome(board.headings), chrome(live.headings))

  const bRec = records(board.headings)
  const lRec = records(live.headings)
  if (bRec.length && lRec.length) {
    const modeOf = (xs, key) => {
      const c = new Map()
      for (const x of xs) c.set(x[key], (c.get(x[key]) || 0) + 1)
      return [...c.entries()].sort((a, b) => b[1] - a[1])[0][0]
    }
    const bf = modeOf(bRec, 'font')
    const lf = modeOf(lRec, 'font')
    if (bf !== lf) out.push(f('font', 'high', 'record title font', bf, lf))
    const bs = modeOf(bRec, 'size')
    const ls = modeOf(lRec, 'size')
    if (Math.abs(bs - ls) > SIZE_TOLERANCE)
      out.push(f('size', 'medium', 'record title size', bs + 'px', ls + 'px'))
    const bw = modeOf(bRec, 'weight')
    const lw = modeOf(lRec, 'weight')
    if (Math.abs(bw - lw) >= 100)
      out.push(f('weight', 'low', 'record title weight', bw, lw))
  } else if (bRec.length && !lRec.length) {
    out.push(
      f('missing-section', 'high', 'board lists records, live shows none', bRec.length, 0)
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
    if (via === 'ordinal' && allowCopy && b.text !== l.text)
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
  for (const [level, texts] of extrasByLevel) {
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
    if (b.buttonShadow.includes('set') && !l.buttonShadow.includes('set'))
      out.push(f('shadow', 'medium', 'no button on live carries a shadow', 'set', 'none'))
    if (b.buttonRadius.length && l.buttonRadius.length) {
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
  // Cards only: they are numerous and consistently classified on both sides, so
  // a modal describes them well. Buttons and inputs are handled by set
  // comparison above, for the reason given there.
  for (const kind of ['card']) {
    const b = board.shapes[kind]
    const l = live.shapes[kind]
    if (!b || !l) continue
    if (Math.abs(b.radius - l.radius) > SIZE_TOLERANCE)
      out.push(f('radius', 'medium', `${kind} radius`, b.radius + 'px', l.radius + 'px'))
    if (b.shadow !== l.shadow) out.push(f('shadow', 'low', `${kind} shadow`, b.shadow, l.shadow))
    if (b.bg !== l.bg) out.push(f('colour', 'low', `${kind} background`, b.bg, l.bg))
    if (Math.abs(b.padY - l.padY) > 4 || Math.abs(b.padX - l.padX) > 4)
      out.push(
        f('spacing', 'low', `${kind} padding`, `${b.padY}/${b.padX}`, `${l.padY}/${l.padX}`)
      )
  }

  // ---- page-level --------------------------------------------------------
  if (board.page.bodyFont !== live.page.bodyFont)
    out.push(f('font', 'high', 'body font', board.page.bodyFont, live.page.bodyFont))
  if (board.page.canvas !== live.page.canvas)
    out.push(f('colour', 'high', 'canvas', board.page.canvas, live.page.canvas))

  const bh = board.page.height
  const lh = live.page.height
  if (bh > 200 && lh > 200) {
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
    const liveSet = new Set(live.paragraphs)
    const missing = board.paragraphs.filter((p) => !liveSet.has(p))
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
  return out
}

module.exports = { compare, matchHeadings }
