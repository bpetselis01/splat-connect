/**
 * Drive both sides over the screen map and write parity-report.json.
 *
 *   node scripts/parity/run.js                  # every screen
 *   node scripts/parity/run.js --group "About"  # one group
 *   node scripts/parity/run.js --id about,hub   # named screens
 *   node scripts/parity/run.js --failing        # only what last run flagged
 *
 * `--failing` is what makes "repeat until parity" terminate: each round
 * re-checks only what is still broken, so round 5 is cheaper than round 1.
 */
const fs = require('fs')
const path = require('path')
const { collectFingerprint } = require('./fingerprint')
const { compare } = require('./compare')
const { provision, signIn, cleanup, adminClient } = require('./auth')
const { seed, dbSample } = require('./seed')

const ROOT = path.resolve(__dirname, '../..')
// Resolved from packages/web: this script lives outside any package, so plain
// require() would look beside it and find nothing.
const { chromium } = require(
  require.resolve('@playwright/test', { paths: [path.join(ROOT, 'packages/web')] })
)
const ARTBOARD = 'http://localhost:8899/SPLAT%20Connect%20-%20Web.dc.html'
const LIVE = process.env.PARITY_LIVE || 'http://localhost:3110'
const REPORT = path.join(__dirname, 'parity-report.json')
const SHOTS = path.join(__dirname, 'shots')
const VIEWPORT = { width: 1440, height: 960 }

// Regulatory wording is fixed by counsel, not by the board — style these pages,
// never their words. See docs/REGULATORY-CHANGES.md.
const NO_COPY = /^\/(legal|privacy|terms|safety|code-of-conduct)/

const argv = process.argv.slice(2)
const flag = (n) => {
  const i = argv.indexOf(n)
  return i === -1 ? null : argv[i + 1]
}

const allScreens = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'screen-map.json'), 'utf8')
)

function loadMap() {
  const all = allScreens
  const group = flag('--group')
  const ids = flag('--id')
  if (ids) return all.filter((s) => ids.split(',').includes(s.id))
  if (group) return all.filter((s) => s.group === group)
  if (argv.includes('--failing') && fs.existsSync(REPORT)) {
    const prev = JSON.parse(fs.readFileSync(REPORT, 'utf8'))
    const bad = new Set(prev.screens.filter((s) => s.findings.length || s.error).map((s) => s.id))
    return all.filter((s) => bad.has(s.id))
  }
  return all
}

/**
 * Dynamic routes need a real record id. Scrape one off a list page rather than
 * querying the database: a scraped link is by construction a page the app
 * itself considers reachable and populated.
 *
 * Matched against the ROUTE TEMPLATE, not against the list page's own path.
 * Deriving the pattern from the list URL assumed the two share a prefix, and
 * across this app they frequently do not — guides are listed at /library but
 * detailed at /tutorials/[id], and /organizations lists links to
 * /organizations/[id]/public, two segments down. Nine screens went unmeasured
 * on that assumption.
 */
async function resolveDynamic(page, entry, cache) {
  const key = entry.route
  if (!cache.has(key)) {
    let found = null
    try {
      await page.goto(LIVE + entry.sampleFrom, {
        waitUntil: 'domcontentloaded',
        timeout: 30000,
      })
      await page.waitForTimeout(600)
      const pattern =
        '^' +
        entry.route
          .split('/')
          .map((seg) =>
            /^\[.+\]$/.test(seg) ? '[^/]+' : seg.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
          )
          .join('/') +
        '$'
      found = await page.evaluate((pat) => {
        const re = new RegExp(pat)
        return (
          [...document.querySelectorAll('a[href]')]
            .map((x) => new URL(x.href, location.origin).pathname)
            .find((p) => re.test(p)) || null
        )
      }, pattern)
    } catch {
      /* falls through to null */
    }
    cache.set(key, found)
  }
  return cache.get(key)
}

async function fingerprintOf(page, url, rootSel) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
  await page.waitForTimeout(700) // let entrance animations settle
  // Playwright serialises the function itself — no string eval needed.
  return page.evaluate(collectFingerprint, rootSel)
}

;(async () => {
  const screens = loadMap()
  fs.mkdirSync(SHOTS, { recursive: true })

  const browser = await chromium.launch()
  const boardCtx = await browser.newContext({ viewport: VIEWPORT })
  const boardPage = await boardCtx.newPage()

  // One signed-in context per role the selected screens actually need, so a
  // run of only public screens costs no account provisioning.
  const needed = [...new Set(screens.map((s) => s.role).filter(Boolean))]
  let users = {}
  const ctxByRole = { guest: await browser.newContext({ viewport: VIEWPORT }) }
  if (needed.length) {
    process.stdout.write(`Provisioning ${needed.join(', ')}...\n`)
    users = await provision(needed)
    for (const role of needed) {
      const ctx = await browser.newContext({ viewport: VIEWPORT })
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

  // Records the parity users own, plus DB-resolved routes for anything the UI
  // does not link to. Keyed by screen id; consulted before scraping.
  let seeded = {}
  if (needed.length) {
    try {
      seeded = await seed(adminClient(), users)
      const n = Object.keys(seeded).length
      if (n) process.stdout.write(`Seeded ${n} fixture route(s)\n`)
    } catch (err) {
      process.stdout.write(`  ! seeding failed: ${String(err.message || err).slice(0, 90)}\n`)
    }
  }

  const cache = new Map()
  const results = []

  for (const s of screens) {
    const row = { id: s.id, name: s.name, group: s.group, route: s.route, findings: [] }
    const role = s.role || 'guest'
    const livePage = pageByRole[role] || pageByRole.guest
    row.role = role
    try {
      let route = s.route
      if (s.sampleFrom) {
        route =
          seeded[s.id] ||
          (await resolveDynamic(livePage, s, cache)) ||
          (await dbSample(adminClient(), s.id))
        // Nested under a dynamic parent (/toy-library/[id]/request): the link
        // is on the parent's detail page, never on a list, so take the parent's
        // already-resolved route and append.
        if (!route && s.derivedFrom) {
          const parent = screens.find((x) => x.id === s.derivedFrom) || allScreens.find((x) => x.id === s.derivedFrom)
          if (parent) {
            const base = cache.get(parent.route) || (await resolveDynamic(livePage, parent, cache))
            if (base) route = base + s.suffix
          }
        }
        if (!route) {
          row.error = `no ${s.route} link on ${s.sampleFrom}`
          row.skipped = true
          results.push(row)
          process.stdout.write(`  ~ ${s.id} (no fixture)\n`)
          continue
        }
        row.route = route
      }

      const board = await fingerprintOf(boardPage, `${ARTBOARD}#${s.id}`, '[data-screen-label]')
      if (!board.headings.length && board.page.height < 100) {
        row.error = 'artboard screen did not render'
        results.push(row)
        process.stdout.write(`  ? ${s.id} (board blank)\n`)
        continue
      }

      const resp = await livePage.goto(LIVE + route, {
        waitUntil: 'domcontentloaded',
        timeout: 45000,
      })
      const status = resp ? resp.status() : 0
      if (status >= 400) {
        row.error = `live returned ${status}`
        row.findings.push({
          type: 'missing-section',
          severity: 'high',
          what: `route ${route} returns ${status}`,
          board: s.boardRoute,
          live: status,
        })
        results.push(row)
        process.stdout.write(`  ! ${s.id} (${status})\n`)
        continue
      }
      await livePage.waitForTimeout(700)
      // Where we actually ended up. A redirect to /login or an onboarding gate
      // renders a perfectly valid page, and without this the report blames the
      // design for sections that were never on screen.
      row.finalUrl = new URL(livePage.url()).pathname
      if (row.finalUrl !== route) {
        row.findings.push({
          type: 'redirected',
          severity: 'high',
          what: `asked for ${route}, landed on ${row.finalUrl}`,
          board: route,
          live: row.finalUrl,
        })
        results.push(row)
        process.stdout.write(`  > ${s.id} redirected -> ${row.finalUrl}\n`)
        continue
      }
      const live = await livePage.evaluate(collectFingerprint, 'main')

      row.findings = compare(board, live, { copy: !NO_COPY.test(route) })
      row.boardHeadings = board.headings.length
      row.liveHeadings = live.headings.length
      results.push(row)
      const n = row.findings.length
      process.stdout.write(`  ${n === 0 ? '✓' : '×'} ${s.id} — ${n} findings\n`)
    } catch (err) {
      row.error = String(err.message || err).slice(0, 200)
      results.push(row)
      process.stdout.write(`  ! ${s.id} — ${row.error.slice(0, 60)}\n`)
    }
  }

  await browser.close()
  if (Object.keys(users).length) await cleanup(users)

  const byType = {}
  for (const r of results) for (const f of r.findings) byType[f.type] = (byType[f.type] || 0) + 1

  const report = {
    at: new Date().toISOString(),
    live: LIVE,
    screens: results,
    summary: {
      screens: results.length,
      clean: results.filter((r) => !r.findings.length && !r.error).length,
      withFindings: results.filter((r) => r.findings.length).length,
      errored: results.filter((r) => r.error).length,
      findings: results.reduce((n, r) => n + r.findings.length, 0),
      byType,
    },
  }

  // A partial run must not erase what it did not re-check.
  if (fs.existsSync(REPORT) && (flag('--group') || flag('--id') || argv.includes('--failing'))) {
    const prev = JSON.parse(fs.readFileSync(REPORT, 'utf8'))
    const seen = new Set(results.map((r) => r.id))
    report.screens = [...results, ...prev.screens.filter((p) => !seen.has(p.id))]
    const all = report.screens
    report.summary = {
      screens: all.length,
      clean: all.filter((r) => !r.findings.length && !r.error).length,
      withFindings: all.filter((r) => r.findings.length).length,
      errored: all.filter((r) => r.error).length,
      findings: all.reduce((n, r) => n + r.findings.length, 0),
      byType: all.reduce((acc, r) => {
        for (const f of r.findings) acc[f.type] = (acc[f.type] || 0) + 1
        return acc
      }, {}),
    }
  }

  fs.writeFileSync(REPORT, JSON.stringify(report, null, 1))
  console.log('\n' + JSON.stringify(report.summary, null, 1))
})()
