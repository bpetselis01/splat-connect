/**
 * Walks every web route as the account whose seeded data it shows, and fails
 * any page that errors, 404s or bounces to /login or onboarding.
 *
 *   node scripts/seed-demo/verify.js [--base http://localhost:3100]
 *
 * Sessions are minted with the service role and written straight into the
 * @supabase/ssr cookie, so the admin account needs no password.
 */
const fs = require('fs')
const path = require('path')
const web = path.resolve(__dirname, '../../packages/web')
const { chromium } = require(require.resolve('@playwright/test', { paths: [web] }))
const { createClient } = require(require.resolve('@supabase/supabase-js', { paths: [web] }))

const m = require('./manifest.json')
const env = (f) =>
  Object.fromEntries(
    fs.readFileSync(path.resolve(__dirname, '../..', f), 'utf8').split('\n').filter((l) => /^[A-Z_]+=/.test(l)).map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1)])
  )
const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = env('packages/api/.env.local')
const ANON = env('packages/web/.env.local').NEXT_PUBLIC_SUPABASE_ANON_KEY
const REF = new URL(SUPABASE_URL).hostname.split('.')[0]
const BASE = process.argv.includes('--base') ? process.argv[process.argv.indexOf('--base') + 1] : 'http://localhost:3100'

async function session(email) {
  const anon = createClient(SUPABASE_URL, ANON, { auth: { persistSession: false } })
  if (email !== 'admin') {
    const { data, error } = await anon.auth.signInWithPassword({ email, password: m.password })
    if (error) throw error
    return data.session
  }
  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data, error } = await admin.auth.admin.generateLink({ type: 'magiclink', email: 'byronpetselisap@gmail.com' })
  if (error) throw error
  const { data: v, error: e2 } = await anon.auth.verifyOtp({ token_hash: data.properties.hashed_token, type: 'magiclink' })
  if (e2) throw e2
  return v.session
}
function cookies(s) {
  const value = 'base64-' + Buffer.from(JSON.stringify(s)).toString('base64')
  const name = `sb-${REF}-auth-token`
  const url = BASE
  if (value.length <= 3180) return [{ name, value, url }]
  const out = []
  for (let i = 0; i * 3180 < value.length; i++) out.push({ name: `${name}.${i}`, value: value.slice(i * 3180, (i + 1) * 3180), url })
  return out
}

const id = m.ids
const X = id.transactions
const stories = m.rows.filter((r) => r.table === 'org_stories').map((r) => r.id)
const child = m.rows.find((r) => r.table === 'child_profiles').id

const PLAN = {
  public: [
    '/', '/about', '/about/partners', '/about/stories', `/about/stories/${stories[0]}`, '/about/support', '/about/team',
    '/code-of-conduct', '/contact', `/contributors/${m.users.mei.id}`, '/get-involved', '/get-involved/contributors',
    '/get-involved/design-challenges', `/get-involved/design-challenges/${id.ideas.active}`, `/get-involved/design-challenges/${id.ideas.graduated}`,
    '/get-involved/events', `/get-involved/events/${id.events.buildDay}`, `/get-involved/events/${id.events.past}`,
    '/get-involved/families', '/get-involved/makers-wanted', '/get-involved/organisations', '/get-involved/recycling',
    '/get-involved/submit-a-tutorial', '/get-involved/submit-an-idea', '/impact', '/learn', '/learn/build-a-switch', '/library',
    '/organizations', `/organizations/${id.orgs.northbank}/public`, `/organizations/${id.orgs.mensShed}/public`, '/printing',
    '/printing/basics', '/privacy', '/safety', '/terms', '/toy-library', `/toy-library/${id.toys.penguin}`, `/toy-library/${id.toys.spinner}`,
    `/tutorials/${id.tutorials.lts}`, `/tutorials/${id.tutorials.bubble}`, `/tutorials/${id.tutorials.book}`, '/legal/contributor-terms',
  ],
  priya: [
    '/dashboard', '/dashboard/challenges', `/dashboard/child/${child}`, '/dashboard/child/new', '/dashboard/events', '/dashboard/exchanges',
    `/dashboard/exchanges/${X.mat}`, `/dashboard/exchanges/${X.bubble}`, `/dashboard/exchanges/${X.spinner}`, `/dashboard/exchanges/build/${X.buildShot}`,
    `/dashboard/exchanges/build/${X.buildOpen}`, '/dashboard/print-requests', `/dashboard/print-requests/${X.printReady}`,
    `/dashboard/print-requests/${X.printRejected}`, '/dashboard/printers', '/dashboard/profile', '/dashboard/saved', '/dashboard/saved/tutorials',
    '/dashboard/saved/toys', '/dashboard/saved/challenges', '/dashboard/saved/organisations', '/dashboard/toys', `/dashboard/toys/${id.toys.mat}`,
    '/dashboard/tutorials', `/tutorials/${id.tutorials.penguin}/edit`, '/notifications', `/toy-library/${id.toys.penguin}/request`,
    `/toy-library/${id.toys.spinner}/request`, `/get-involved/events/${id.events.buildDay}/register`, '/get-involved/requests', '/get-involved/requests/new',
    '/get-involved/makers-wanted/new', '/get-involved/organisations/request', '/get-involved/recycling/drop-off', `/printing/requests?guide=${id.tutorials.lts}`,
    '/onboarding/child', '/upload',
  ],
  tom: ['/dashboard', '/dashboard/toys', '/dashboard/exchanges', `/dashboard/exchanges/${X.penguin}`, `/dashboard/print-requests/${X.printDone}`, '/notifications', '/dashboard/events'],
  mei: ['/dashboard', '/dashboard/tutorials', `/tutorials/${id.tutorials.lts}/edit`, `/tutorials/${id.tutorials.sst}/edit`, '/dashboard/printers', '/dashboard/printers/new', `/dashboard/print-requests/${X.printStalled}`, `/dashboard/exchanges/build/${X.buildDone}`, '/dashboard/toys', '/notifications'],
  dan: ['/dashboard', `/dashboard/exchanges/build/${X.buildSilent}`, '/dashboard/printers', '/notifications', '/dashboard/challenges'],
  sarah: [
    '/dashboard', '/dashboard/organisation', '/dashboard/organisation/events/new', '/dashboard/organisation/orders', '/dashboard/organisation/profile',
    '/dashboard/organisation/publish', '/dashboard/organisation/recycling', '/dashboard/organisation/requests', '/dashboard/organisation/stories/new',
    '/dashboard/organisation/toys', `/dashboard/org/events/${id.events.buildDay}`, `/organizations/${id.orgs.northbank}`,
    `/organizations/${id.orgs.northbank}/projects/${id.tutorials.rumble}`, `/dashboard/exchanges/${X.spinner}`, `/dashboard/print-requests/${X.printReady}`, '/notifications',
  ],
  hamish: ['/dashboard/organisation', '/dashboard/organisation/recycling', '/dashboard/organisation/publish', '/notifications'],
  admin: [
    '/admin', '/admin/build-requests', '/admin/content', '/admin/contributors', '/admin/ideas', `/admin/ideas/${id.ideas.pending}`, '/admin/inbox',
    '/admin/organization-requests', '/admin/organizations', '/admin/print-jobs', '/admin/reports', '/admin/review', `/admin/review/${id.tutorials.rumble}`, '/admin/spot-check',
  ],
}

const BAD = /Application error|Something went wrong|Unhandled Runtime Error|This page could not be found|Internal Server Error/i

;(async () => {
  const browser = await chromium.launch()
  const results = []
  for (const [who, routes] of Object.entries(PLAN)) {
    const ctx = await browser.newContext()
    if (who !== 'public') await ctx.addCookies(cookies(await session(who === 'admin' ? 'admin' : m.users[who].email)))
    const page = await ctx.newPage()
    for (const r of routes) {
      let status = 0, problem = ''
      try {
        const res = await page.goto(BASE + r, { waitUntil: 'networkidle', timeout: 120000 })
        status = res?.status() ?? 0
        const url = new URL(page.url())
        const text = await page.locator('body').innerText()
        if (status >= 400) problem = `HTTP ${status}`
        else if (who !== 'public' && /^\/(login|onboarding\/contributor-terms)/.test(url.pathname) && !r.startsWith(url.pathname)) problem = `bounced to ${url.pathname}`
        else if (BAD.test(text)) problem = text.match(BAD)[0]
      } catch (e) {
        problem = e.message.split('\n')[0]
      }
      results.push({ who, r, problem })
      console.log(`${problem ? '✗' : '✓'} ${who.padEnd(7)} ${r}${problem ? '  — ' + problem : ''}`)
    }
    await ctx.close()
  }
  await browser.close()
  const bad = results.filter((x) => x.problem)
  console.log(`\n${results.length - bad.length}/${results.length} pages clean.`)
  process.exit(bad.length ? 1 : 0)
})()
