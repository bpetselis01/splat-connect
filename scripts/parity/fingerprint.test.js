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

  // React Native web: weight lives in the family name (expo-google-fonts
  // registers Baloo2_800ExtraBold at CSS weight 400), no font on body, and the
  // screen paints its own background on an inner view.
  await page.setContent(`
    <body style="margin:0;background:transparent;font-family:Times">
    <div id="root" style="background:transparent">
      <div style="background:rgb(242,242,242);min-height:600px"><div style="background:rgb(250,249,247);min-height:600px">
        <div style="font-family:Baloo2_800ExtraBold;font-size:28px;font-weight:400">Guide library</div>
        <div style="font-family:Nunito_400Regular;font-size:15px">Step-by-step guides for switch-adapting toys and building assistive tech.</div>
      </div></div>
    </div></body>`)
  const rn = await page.evaluate(collectFingerprint, { root: '#root' })
  const title = rn.headings.find((x) => x.text === 'guide library')
  assert.ok(title, 'bold-by-family heading not detected')
  assert.strictEqual(title.font, 'Baloo 2', 'family not normalised')
  assert.strictEqual(title.weight, 800, 'weight not read from the family name')
  assert.strictEqual(rn.page.canvas, 'rgb(250,249,247)', 'canvas not taken from the screen')
  assert.strictEqual(rn.page.bodyFont, 'Nunito', 'body font not taken from the text')

  // React Native web: prose is <div dir="auto">, and a TextInput is a bare
  // <input> inside the view that draws the field.
  await page.setContent(`
    <div id="root">
      <div dir="auto" style="font-family:Nunito_400Regular;font-size:15px">Pick up to three printers. The first to accept takes the job.</div>
      <div style="border:1.5px solid rgb(220,220,220);border-radius:14px;background:rgb(255,255,255);padding:0 12px">
        <input style="border:0;border-radius:0;background:transparent;height:44px" placeholder="Search">
      </div>
    </div>`)
  const f2 = await page.evaluate(collectFingerprint, { root: '#root' })
  assert.ok(f2.paragraphs.some((t) => t.startsWith('pick up to three printers')), 'RN prose not collected')
  assert.strictEqual(f2.shapes.input.radius, 14, 'field radius taken from the bare input')
  assert.strictEqual(f2.shapes.input.bg, 'rgb(255,255,255)', 'field fill taken from the bare input')
  await browser.close()
  console.log('fingerprint: 11 checks passed')
})().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
