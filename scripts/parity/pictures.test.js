/** Run: node scripts/parity/pictures.test.js */
const assert = require('node:assert')
const { mergePictures, bundleIsLocal } = require('./pictures')

// Recording pictures must not erase what the numeric pass found: a stale
// numeric exemption is a finding the picture pass has no business clearing.
{
  const row = {
    findings: [
      { type: 'stale-exemption', what: 'colour "input background" no longer occurs' },
      { type: 'stale-exemption', what: 'picture "old" no longer occurs' },
      { type: 'picture', what: 'last run' },
    ],
    explained: [{ type: 'radius', what: 'kept' }],
  }
  const out = mergePictures(row, [{ what: 'header covers the form', board: 'b', live: 'l' }], [])
  assert.deepStrictEqual(
    out.findings.map((f) => f.what),
    ['colour "input background" no longer occurs', 'header covers the form'],
    'numeric stale exemption lost, or old picture findings kept'
  )
  assert.deepStrictEqual(out.explained.map((f) => f.what), ['kept'])
}

// Only an app built against the local stack may be driven: a dev bundle reads
// packages/mobile/.env.local at runtime, which names the hosted project.
assert.strictEqual(bundleIsLocal(Buffer.from('url:"http://localhost:54321" docs:"https://xyzcompany.supabase.co"')), true)
assert.strictEqual(bundleIsLocal(Buffer.from('url:"https://abcdefghijklmnopqrst.supabase.co"')), false)
assert.strictEqual(bundleIsLocal(Buffer.from('url:"http://localhost:54321" other:"https://abcdefghijklmnopqrst.supabase.co"')), false)
assert.strictEqual(bundleIsLocal(null), false, 'no embedded bundle is a dev client')
console.log('pictures: 5 checks passed')
