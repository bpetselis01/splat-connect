/**
 * The picture pass's two judgements, pure so they can be tested.
 */
const { explain } = require('./compare')

/**
 * A row after recording judged picture findings: this run's pictures, through
 * the row's picture rules, replace the last run's. Numeric findings, their
 * stale exemptions included, are the numeric pass's and stay.
 */
function mergePictures(row, judged, rules) {
  const mine = judged.map((j) => ({ type: 'picture', severity: 'medium', what: j.what, board: j.board, live: j.live }))
  const { findings, explained } = explain(mine, rules)
  const pictureStale = (f) => f.type === 'stale-exemption' && f.what.startsWith('picture ')
  return {
    ...row,
    findings: [...row.findings.filter((f) => f.type !== 'picture' && !pictureStale(f)), ...findings],
    explained: [...(row.explained || []).filter((f) => f.type !== 'picture'), ...explained],
  }
}

/**
 * Whether an installed app's embedded bundle is built against the local stack:
 * it names local Supabase and no hosted project (a 20-letter ref; library docs
 * carry example hosts). No embedded bundle is a dev client, which reads
 * packages/mobile/.env.local at runtime and so the hosted project.
 */
function bundleIsLocal(buf) {
  if (!buf) return false
  const s = buf.toString('latin1')
  return s.includes('http://localhost:54321') && !/https:\/\/[a-z]{20}\.supabase\.co/.test(s)
}

module.exports = { mergePictures, bundleIsLocal }
