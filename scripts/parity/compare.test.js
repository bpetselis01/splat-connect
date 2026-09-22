/**
 * Run: node scripts/parity/compare.test.js
 *
 * compare() is pure, so the asymmetry that produced phantom findings can be
 * pinned down here rather than by re-running 119 screens through a browser.
 */
const assert = require('node:assert')
const { compare } = require('./compare')

const h = (level, text, extra = {}) => ({
  level,
  text,
  font: 'Baloo 2',
  size: 24,
  weight: 800,
  colour: 'rgb(28,37,48)',
  inCard: false,
  ...extra,
})
const shape = { radius: 18, shadow: 'none', bg: 'rgb(255,255,255)' }
const fp = (headings, extra = {}) => ({
  headings,
  cardTitles: [],
  counts: { cards: 0, buttons: 0, inputs: 0, images: 0, tables: 0, lists: 0, rows: 0 },
  shapes: { card: shape, button: shape, input: shape },
  sets: { buttonRadius: [], buttonShadow: [], inputRadius: [], inputBg: [] },
  paragraphs: [],
  page: { height: 1000, canvas: 'rgb(255,255,255)', ink: 'rgb(28,37,48)', bodyFont: 'Nunito' },
  ...extra,
})
const types = (out, t) => out.filter((x) => x.type === t)

// A section the live page wraps in a card and the board does not is present,
// not missing — /learn/safe-handling reported three of these.
{
  const board = fp([h(1, 'safe handling'), h(2, 'wear this every time')])
  const live = fp([h(1, 'safe handling'), h(2, 'wear this every time', { inCard: true })])
  const out = compare(board, live)
  assert.deepStrictEqual(types(out, 'missing-section'), [], 'card-wrapped section read as missing')
}

// The mirror: on the board it is in a card, on live it is not. Not an extra.
{
  const board = fp([h(2, 'feedback', { inCard: true })])
  const live = fp([h(2, 'feedback')])
  const out = compare(board, live)
  assert.deepStrictEqual(types(out, 'extra-section'), [], 'board card section read as live extra')
}

// Still catches a section that genuinely is not there.
{
  const board = fp([h(2, 'wear this every time'), h(2, 'batteries out first')])
  const live = fp([h(2, 'wear this every time')])
  const out = compare(board, live)
  assert.strictEqual(types(out, 'missing-section').length, 1, 'real missing section lost')
  assert.strictEqual(types(out, 'missing-section')[0].board, 'batteries out first')
}

// A cross-card match is still compared on how it is set, never on wording.
{
  const board = fp([h(2, 'wear this every time')])
  const live = fp([h(2, 'wear this every time', { inCard: true, font: 'Nunito' })])
  const out = compare(board, live)
  assert.strictEqual(types(out, 'font').length, 1, 'cross-card pair not compared on font')
  assert.deepStrictEqual(types(out, 'copy'), [], 'equal words reported as a copy finding')
}

console.log('compare: 4 checks passed')

// A table page's height tracks its row count the way a card page's tracks
// its cards: five queued guides on the board against the queue's hundreds is
// data volume, not a missing section. /admin/review reported 1258px against
// 12242px with rows the only thing that differed.
{
  const counts = (rows) => ({ cards: 0, buttons: 0, inputs: 0, images: 0, tables: 1, lists: 0, rows })
  const board = fp([h(1, 'review queue')], { counts: counts(5), page: { ...fp([]).page, height: 1258 } })
  const live = fp([h(1, 'review queue')], { counts: counts(180), page: { ...fp([]).page, height: 12242 } })
  assert.deepStrictEqual(types(compare(board, live), 'missing-section'), [], 'row volume read as missing section')
  // Same row count, same height gap: still a real finding.
  const short = fp([h(1, 'review queue')], { counts: counts(5), page: { ...fp([]).page, height: 12242 } })
  assert.strictEqual(types(compare(board, short), 'missing-section').length, 1, 'real height gap lost')
}
