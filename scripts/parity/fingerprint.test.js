/**
 * Run: node scripts/parity/fingerprint.test.js
 * collectFingerprint runs in a page, so it is tested in one.
 */
const assert = require('node:assert')
const path = require('path')
const { collectFingerprint } = require('./fingerprint')
const { chromium } = require(
  require.resolve('@playwright/test', { paths: [path.resolve(__dirname, '../../packages/web')] })
)

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setContent(`
    <main id="screen">
      <div role="heading" aria-level="2" style="font-size:14px;font-weight:800;text-transform:none">Your guides</div>
      <p style="font-size:15px">A paragraph long enough to count as prose on this screen.</p>
      <nav role="tablist" id="tabs">
        <div style="font-size:22px;font-weight:800">Guides</div>
        <button style="background:rgb(20,90,200);color:white;padding:10px">Toys</button>
      </nav>
    </main>`)
  const fp = await page.evaluate(collectFingerprint, { root: '#screen', exclude: '#tabs' })
  const texts = fp.headings.map((h) => h.text)
  assert.ok(texts.includes('your guides'), 'role=heading at 14px not treated as semantic')
  assert.ok(!texts.includes('guides'), 'excluded tab bar heading leaked in')
  assert.strictEqual(fp.counts.buttons, 0, 'excluded tab bar button counted')
  // The old string form still works.
  const legacy = await page.evaluate(collectFingerprint, '#screen')
  assert.ok(legacy.headings.map((h) => h.text).includes('guides'), 'string root form broken')
  await browser.close()
  console.log('fingerprint: 3 checks passed')
})().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
