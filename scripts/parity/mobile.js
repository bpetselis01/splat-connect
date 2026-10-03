/**
 * Phone-width audit of every live web screen. No board: the Soft Pop web board
 * is drawn at desktop width only, so this measures the page against the phone.
 *
 *   node scripts/parity/mobile.js                 # every screen
 *   node scripts/parity/mobile.js --id home,hub   # named screens
 *   node scripts/parity/mobile.js --failing       # only what last run flagged
 *   node scripts/parity/mobile.js --shots         # also save mobile/<id>.png
 *
 * Findings, per screen:
 *   overflow   the page scrolls sideways (scrollWidth > viewport)
 *   clipped    an element pokes past the viewport edge and nothing scrolls it
 *   target     a control smaller than 24x24 (WCAG 2.5.8), inline links exempt
 *   zoom       a text input under 16px, which makes iOS Safari zoom on focus
 *   tiny       text under 10px (the 11px pill/eyebrow is the type scale's)
 */
const fs = require('fs')
const path = require('path')
const { provision, signIn, cleanup, adminClient } = require('./auth')
const { seed, unseed } = require('./seed')
const { resolveRoute } = require('./routes')

const ROOT = path.resolve(__dirname, '../..')
const { chromium, devices } = require(
  require.resolve('@playwright/test', { paths: [path.join(ROOT, 'packages/web')] })
)
const LIVE = process.env.PARITY_LIVE || 'http://localhost:3110'
const REPORT = process.env.MOBILE_REPORT || path.join(__dirname, 'mobile-report.json')
const SHOTS = path.join(__dirname, 'mobile')
// iPhone 14: 390x844, touch, mobile UA — the width most phones land within.
const DEVICE = devices['iPhone 14']

const argv = process.argv.slice(2)
const flag = (n) => {
  const i = argv.indexOf(n)
  return i === -1 ? null : argv[i + 1]
}
// The board's screens, plus live pages the board never drew.
const allScreens = ['screen-map.json', 'mobile-extra.json'].flatMap((f) =>
  JSON.parse(fs.readFileSync(path.join(__dirname, f), 'utf8'))
)

function loadMap() {
  const ids = flag('--id')
  if (ids) return allScreens.filter((s) => ids.split(',').includes(s.id))
  if (argv.includes('--failing') && fs.existsSync(REPORT)) {
    const prev = JSON.parse(fs.readFileSync(REPORT, 'utf8'))
    const bad = new Set(prev.screens.filter((s) => s.findings.length || s.error).map((s) => s.id))
    return allScreens.filter((s) => bad.has(s.id))
  }
  return allScreens
}

/** Runs in the page. Serialised by Playwright, so self-contained. */
function audit() {
  const W = window.innerWidth
  const doc = document.scrollingElement
  const findings = []
  const name = (el) => {
    const cls = typeof el.className === 'string' ? el.className.split(/\s+/).slice(0, 3).join('.') : ''
    const txt = (el.innerText || el.getAttribute('aria-label') || el.value || '').trim().slice(0, 40)
    return `${el.tagName.toLowerCase()}${cls ? '.' + cls : ''}${txt ? ` "${txt}"` : ''}`
  }
  const visible = (el, r) => {
    if (!r.width || !r.height) return false
    const cs = getComputedStyle(el)
    return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity !== 0
  }
  // A sideways scroller between el and the page is a deliberate carousel; an
  // overflow:hidden/clip one is not — it is exactly how a row gets cut off
  // without the page ever scrolling. sr-only content clips itself.
  const scrolled = (el) => {
    for (let p = el; p && p !== document.body; p = p.parentElement) {
      const cs = getComputedStyle(p)
      if (p !== el && /auto|scroll/.test(cs.overflowX)) return true
      if (cs.clip && cs.clip !== 'auto') return true
      if (p.getAttribute('aria-hidden') === 'true') return true
      // A map viewport pans: its tiles and overlays extend past it on purpose.
      if (p.classList.contains('leaflet-container')) return true
    }
    return false
  }
  // Glows and blobs are empty boxes that bleed on purpose.
  const MEDIA = 'img,svg,video,canvas,input,button,a,select,textarea'
  const hasContent = (el) =>
    !!(el.innerText || '').trim() || el.matches(MEDIA) || !!el.querySelector(MEDIA)

  const over = doc.scrollWidth - W
  if (over > 1) findings.push({ type: 'overflow', what: `page scrolls ${over}px sideways` })

  const clipped = new Set()
  for (const el of document.body.querySelectorAll('*')) {
    const r = el.getBoundingClientRect()
    if (!visible(el, r)) continue
    if (r.right <= W + 1 && r.left >= -1) continue
    if ([...clipped].some((c) => c.contains(el))) continue
    if (!hasContent(el) || scrolled(el)) continue
    clipped.add(el)
  }
  for (const el of clipped) {
    const r = el.getBoundingClientRect()
    findings.push({
      type: 'clipped',
      what: `${name(el)} spans ${Math.round(r.left)}..${Math.round(r.right)} of ${W}`,
    })
  }

  const CONTROLS = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab]'
  for (const el of document.body.querySelectorAll(CONTROLS)) {
    const r = el.getBoundingClientRect()
    if (!visible(el, r) || scrolled(el) && (r.right > W || r.left < 0)) continue
    // Inline links in running text are exempt from 2.5.8.
    if (el.tagName === 'A' && getComputedStyle(el).display === 'inline' && el.closest('p,li,dd,td'))
      continue
    // The licence-required map attribution is third-party chrome.
    if (el.closest('.leaflet-control-attribution')) continue
    // A checkbox/radio inside its label: the label is the target.
    let box = r
    if (el.matches('input[type=checkbox],input[type=radio]')) {
      const lab = el.closest('label') || (el.id && document.querySelector(`label[for="${el.id}"]`))
      if (lab) box = lab.getBoundingClientRect()
    }
    // sr-only: a skip link or a file input behind its styled label.
    if (box.width <= 1 && box.height <= 1) continue
    if (box.width < 24 || box.height < 24)
      findings.push({
        type: 'target',
        what: `${name(el)} is ${Math.round(box.width)}x${Math.round(box.height)}`,
      })
    if (
      el.matches('input:not([type=checkbox]):not([type=radio]):not([type=range]):not([type=file]),select,textarea') &&
      parseFloat(getComputedStyle(el).fontSize) < 16
    )
      findings.push({ type: 'zoom', what: `${name(el)} at ${getComputedStyle(el).fontSize}` })
  }

  const tiny = new Map()
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const el = n.parentElement
    if (!el || !n.textContent.trim()) continue
    const r = el.getBoundingClientRect()
    if (!visible(el, r)) continue
    const fs = parseFloat(getComputedStyle(el).fontSize)
    if (fs < 10 && !tiny.has(el)) tiny.set(el, fs)
  }
  for (const [el, fs] of tiny) findings.push({ type: 'tiny', what: `${name(el)} at ${fs}px` })

  return { findings, height: doc.scrollHeight }
}

;(async () => {
  const screens = loadMap()
  const browser = await chromium.launch()
  const ctxOpts = { ...DEVICE, deviceScaleFactor: 1 }

  const needed = [...new Set(screens.map((s) => s.role).filter(Boolean))]
  let users = {}
  const ctxByRole = { guest: await browser.newContext(ctxOpts) }
  if (needed.length) {
    process.stdout.write(`Provisioning ${needed.join(', ')}...\n`)
    users = await provision(needed)
    for (const role of needed) {
      const ctx = await browser.newContext(ctxOpts)
      const res = await signIn(ctx, LIVE, users[role])
      if (!res.ok) process.stdout.write(`  ! could not sign in as ${role}: ${res.reason}\n`)
      ctxByRole[role] = ctx
    }
  }
  const pageByRole = {}
  for (const [role, ctx] of Object.entries(ctxByRole)) {
    const pg = await ctx.newPage()
    pg.on('pageerror', () => {})
    pageByRole[role] = pg
  }

  let seeded = {}
  if (needed.length) {
    try {
      seeded = await seed(adminClient(), users)
    } catch (err) {
      process.stdout.write(`  ! seeding failed: ${String(err.message || err).slice(0, 90)}\n`)
    }
  }

  const cache = new Map()
  const results = []
  if (argv.includes('--shots')) fs.mkdirSync(SHOTS, { recursive: true })

  for (const s of screens) {
    const role = s.role || 'guest'
    const page = pageByRole[role] || pageByRole.guest
    const row = { id: s.id, name: s.name, group: s.group, role, route: s.route, findings: [] }
    try {
      const route = await resolveRoute(s, {
        page,
        live: LIVE,
        seeded,
        cache,
        screens,
        allScreens,
        db: adminClient(),
      })
      if (!route) {
        row.error = 'no fixture'
        results.push(row)
        process.stdout.write(`  ~ ${s.id} (no fixture)\n`)
        continue
      }
      row.route = route
      const resp = await page.goto(LIVE + route, { waitUntil: 'domcontentloaded', timeout: 45000 })
      if (resp && resp.status() >= 400) row.error = `live returned ${resp.status()}`
      await page.waitForTimeout(900)
      row.finalUrl = new URL(page.url()).pathname
      const res = await page.evaluate(audit)
      row.findings = res.findings
      row.height = res.height
      if (argv.includes('--shots'))
        await page.screenshot({ path: path.join(SHOTS, `${s.id}.png`), fullPage: true })
      results.push(row)
      const n = row.findings.length
      const redirect = row.finalUrl !== route.split('?')[0] ? ` (-> ${row.finalUrl})` : ''
      process.stdout.write(`  ${n ? '×' : '✓'} ${s.id} — ${n}${redirect}\n`)
    } catch (err) {
      row.error = String(err.message || err).slice(0, 200)
      results.push(row)
      process.stdout.write(`  ! ${s.id} — ${row.error.slice(0, 60)}\n`)
    }
  }

  await browser.close()
  await unseed(adminClient()).catch(() => {})
  if (Object.keys(users).length) await cleanup(users)

  let all = results
  if (fs.existsSync(REPORT) && (flag('--id') || argv.includes('--failing'))) {
    const prev = JSON.parse(fs.readFileSync(REPORT, 'utf8'))
    const seen = new Set(results.map((r) => r.id))
    all = [...results, ...prev.screens.filter((p) => !seen.has(p.id))]
  }
  const byType = {}
  for (const r of all) for (const f of r.findings) byType[f.type] = (byType[f.type] || 0) + 1
  const summary = {
    screens: all.length,
    clean: all.filter((r) => !r.findings.length && !r.error).length,
    errored: all.filter((r) => r.error).length,
    findings: all.reduce((n, r) => n + r.findings.length, 0),
    byType,
  }
  fs.writeFileSync(
    REPORT,
    JSON.stringify({ at: new Date().toISOString(), live: LIVE, screens: all, summary }, null, 1)
  )
  console.log('\n' + JSON.stringify(summary, null, 1))
})()
