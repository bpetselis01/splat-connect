/**
 * Print one board screen's headings and prose, by screen id.
 *
 * The fingerprint reads type and radii; the words only come out of here. Read
 * only — safe to run while the parity stack is serving other agents.
 *
 *   node scripts/parity/board-dump.js contributor org_public
 *
 * Run from packages/web (it resolves Playwright from there), with the stack up.
 */
const path = require('path')
const P = '/Users/byronpetselis/Documents/splat-connect'
const { chromium } = require(require.resolve('@playwright/test', { paths: [path.join(P,'packages/web')] }))
const ARTBOARD = 'http://localhost:8899/SPLAT%20Connect%20-%20Web.dc.html'
;(async () => {
  const b = await chromium.launch()
  const pg = await b.newPage({ viewport: { width: 1440, height: 960 } })
  for (const id of process.argv.slice(2)) {
    await pg.goto(`${ARTBOARD}#${id}`, { waitUntil: 'domcontentloaded' })
    await pg.waitForTimeout(900)
    const out = await pg.evaluate(() => {
      const root = document.querySelector('[data-screen-label]')
      if (!root) return null
      const t = (el) => el.innerText.replace(/\s+/g, ' ').trim()
      return {
        label: root.getAttribute('data-screen-label'),
        h: [...root.querySelectorAll('h1,h2,h3,h4')].map((e) => e.tagName + ' ' + t(e)),
        p: [...root.querySelectorAll('p')].map(t).filter((x) => x.length > 25),
      }
    })
    console.log('\n===', id, out && out.label)
    if (out) { out.h.forEach((x) => console.log('  ', x)); console.log(''); out.p.forEach((x) => console.log('  P:', x)) }
  }
  await b.close()
})()
