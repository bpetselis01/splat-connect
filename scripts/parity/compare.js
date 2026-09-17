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
  const { pairs, extras } = matchHeadings(board.headings, live.headings)

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

  for (const e of extras)
    out.push(f('extra-section', 'medium', `live has an extra h${e.level}`, null, e.text))

  // ---- component shape ---------------------------------------------------
  for (const kind of ['card', 'button', 'input']) {
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
