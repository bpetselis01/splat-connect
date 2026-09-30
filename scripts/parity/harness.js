/**
 * The comparison loop shared by run.js (web) and app.js (the mobile app):
 * drive the artboard and the live target over a screen map and write a
 * report. Each runner only describes its target; see runParity().
 *
 * `--failing` is what makes "repeat until parity" terminate: each round
 * re-checks only what is still broken, so round 5 is cheaper than round 1.
 */
const fs = require('fs')
const path = require('path')
const { collectFingerprint, collectChrome } = require('./fingerprint')
const { compare, explain } = require('./compare')
const { provision, cleanup, adminClient } = require('./auth')
const { seed, unseed } = require('./seed')

const ROOT = path.resolve(__dirname, '../..')
// Resolved from packages/web: this script lives outside any package, so plain
// require() would look beside it and find nothing.
const { chromium } = require(
  require.resolve('@playwright/test', { paths: [path.join(ROOT, 'packages/web')] })
)
const SHOTS = path.join(__dirname, 'shots')

// Regulatory wording is fixed by counsel, not by the board — style these pages,
// never their words. See docs/REGULATORY-CHANGES.md.
// Counsel owns these pages' words AND their sections, so the board is not
// authoritative for either. Style still is. See docs/REGULATORY-CHANGES.md.
const NO_COPY = /^\/(legal|privacy|terms|safety|code-of-conduct)/

const argv = process.argv.slice(2)
const flag = (n) => {
  const i = argv.indexOf(n)
  return i === -1 ? null : argv[i + 1]
}

function loadMap(all, REPORT) {
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

async function fingerprintOf(page, url, rootSel, role) {
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45000 })
  // The board has a "Viewing as" select with the harness's own five role
  // names, and several screens draw a different branch per role. Loading it
  // by hash alone left it on its default, so /get-involved/organisations/
  // request compared the board's signed-out gate (263px) against live signed
  // in as a parent, and reported the sign-in prompt as a missing h1.
  if (role)
    await page
      .selectOption('select[aria-label="Viewing as"]', role, { timeout: 3000 })
      .then(() => page.waitForTimeout(400))
      .catch(() => {})
  await page.waitForTimeout(700) // let entrance animations settle
  // Playwright serialises the function itself — no string eval needed.
  return page.evaluate(collectFingerprint, rootSel)
}

/**
 * target: {
 *   map, report        absolute paths of the screen map and the report
 *   board              artboard page URL, without the #hash
 *   live               live origin
 *   pairsDir           where --shots writes <id>.board.png / <id>.live.png
 *   boardViewport, liveViewport   { width, height }
 *   liveScope          collectFingerprint's argument for the live side
 *   launchArgs         chromium.launch args
 *   signIn(context, origin, user) -> { ok, reason? }
 *   prepare(page)      after each live goto, before fingerprinting
 *   resolve(s, ctx)    the route to load, or null to skip the row
 *   compareOpts(s)     extra compare() options per screen
 * }
 */
async function runParity(target) {
  // PARITY_REPORT lets parallel agents measure without racing each other's merge.
  const REPORT = process.env.PARITY_REPORT || target.report
  const LIVE = target.live
  const PAIRS = target.pairsDir
  const allScreens = JSON.parse(fs.readFileSync(target.map, 'utf8'))
  const screens = loadMap(allScreens, REPORT)
  fs.mkdirSync(SHOTS, { recursive: true })

  const browser = await chromium.launch({ args: target.launchArgs || [] })
  const boardCtx = await browser.newContext({ viewport: target.boardViewport })
  const boardPage = await boardCtx.newPage()

  // One signed-in context per role the selected screens actually need, so a
  // run of only public screens costs no account provisioning.
  // `seedRole`: a screen whose record another role's fixtures create (the
  // leader's org, event), so a partial run of it still seeds that record.
  const needed = [...new Set(screens.flatMap((s) => [s.role, s.seedRole]).filter(Boolean))]
  let users = {}
  const ctxByRole = { guest: await browser.newContext({ viewport: target.liveViewport }) }
  if (needed.length) {
    process.stdout.write(`Provisioning ${needed.join(', ')}...\n`)
    users = await provision(needed)
    for (const role of needed) {
      const ctx = await browser.newContext({ viewport: target.liveViewport })
      const res = await target.signIn(ctx, LIVE, users[role])
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
      // A board screen with no single live screen, and the reason why.
      if (s.skip) {
        row.skipped = true
        row.error = `skipped: ${s.skip}`
        results.push(row)
        process.stdout.write(`  ~ ${s.id} (skipped)\n`)
        continue
      }
      // A target's resolver returns the route itself for a static screen.
      const route = await target.resolve(s, {
        page: livePage,
        live: LIVE,
        seeded,
        cache,
        screens,
        allScreens,
        db: adminClient(),
      })
      if (!route) {
        row.error = `no record for ${s.route}${s.sampleFrom ? ` (no link on ${s.sampleFrom})` : ''}`
        row.skipped = true
        results.push(row)
        process.stdout.write(`  ~ ${s.id} (no fixture)\n`)
        continue
      }
      row.route = route

      const board = await fingerprintOf(boardPage, `${target.board}#${s.id}`, '[data-screen-label]', role)
      if (argv.includes('--shots')) {
        fs.mkdirSync(PAIRS, { recursive: true })
        // The app target shoots the board's screen alone, not the whole artboard page.
        const shot = path.join(PAIRS, `${s.id}.board.png`)
        if (target.boardShot) await boardPage.locator(target.boardShot).first().screenshot({ path: shot })
        else await boardPage.screenshot({ path: shot, fullPage: true })
      }
      if (!board.headings.length && board.page.height < 100) {
        row.error = 'artboard screen did not render'
        results.push(row)
        process.stdout.write(`  ? ${s.id} (board blank)\n`)
        continue
      }

      // `stall`: a request pattern held open, so a loading state stays up to be
      // measured (the board's Loading screen is the skeleton).
      // Nothing held open by an earlier screen, even one that threw.
      await livePage.unrouteAll({ behavior: 'ignoreErrors' }).catch(() => {})
      if (s.stall) await livePage.route(s.stall, () => {})
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
      await target.prepare(livePage, s)
      // Where we actually ended up. A redirect to /login or an onboarding gate
      // renders a perfectly valid page, and without this the report blames the
      // design for sections that were never on screen.
      row.finalUrl = new URL(livePage.url()).pathname
      // Path against path: a route that carries its record in the query string
      // lands on its own pathname, and comparing that against the full asked-for
      // URL called every such screen a redirect.
      if (row.finalUrl !== route.split('?')[0]) {
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
      if (argv.includes('--shots'))
        await livePage.screenshot({ path: path.join(PAIRS, `${s.id}.live.png`), fullPage: true })
      // A screen can exclude more chrome of its own (a tab root's ScreenHeader,
      // which the board draws in its nav bar, outside the screen).
      const scope =
        s.liveExclude && typeof target.liveScope === 'object'
          ? { ...target.liveScope, exclude: `${target.liveScope.exclude}, ${s.liveExclude}` }
          : target.liveScope
      const live = await livePage.evaluate(collectFingerprint, scope)
      live.chrome = await livePage.evaluate(collectChrome)

      // `stateOnly` marks a board screen that draws a STATE of a live route the
      // harness cannot get into — /signup (sent) needs a submitted form. Its
      // sections and words describe that state, so only style is comparable.
      const contentIsOurs = !NO_COPY.test(route) && !s.stateOnly
      row.findings = compare(board, live, {
        // A record's prose is its own data, like its title below.
        copy: contentIsOurs && !(s.sampleFrom || s.derivedFrom),
        // The state's cards are not on the page the harness can reach: /signup
        // before sending is role tiles, the sent state one .auth-card.
        shapes: !s.stateOnly,
        structure: contentIsOurs,
        // On a detail screen the <h1> is the record's own name — the board's
        // "Bubble machine" against a fixture's "E2E reflow detail 1-2". That is
        // the sample data differing, which this report ignores everywhere else,
        // so the title is compared for how it is SET but not for what it says.
        recordTitleH1: !!(s.sampleFrom || s.derivedFrom),
        ...target.compareOpts(s),
      })
      Object.assign(row, explain(row.findings, s.explained))
      if (s.stall) await livePage.unroute(s.stall)
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
  // Fixture rows that do not cascade with the users go first: some of them
  // RESTRICT the deletes cleanup() runs.
  await unseed(adminClient()).catch(() => {})
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
      errored: results.filter((r) => r.error && !r.skipped).length,
      skipped: results.filter((r) => r.skipped).length,
      findings: results.reduce((n, r) => n + r.findings.length, 0),
      explained: results.reduce((n, r) => n + (r.explained?.length || 0), 0),
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
      errored: all.filter((r) => r.error && !r.skipped).length,
      skipped: all.filter((r) => r.skipped).length,
      findings: all.reduce((n, r) => n + r.findings.length, 0),
      explained: all.reduce((n, r) => n + (r.explained?.length || 0), 0),
      byType: all.reduce((acc, r) => {
        for (const f of r.findings) acc[f.type] = (acc[f.type] || 0) + 1
        return acc
      }, {}),
    }
  }

  fs.writeFileSync(REPORT, JSON.stringify(report, null, 1))
  console.log('\n' + JSON.stringify(report.summary, null, 1))
}

module.exports = { runParity }
