/**
 * Signed-in browser contexts, one per role the board uses.
 *
 * 54 of the 119 screens sit behind auth. Without this the harness follows
 * /dashboard's 307 to /login and cheerfully compares the board's twelve-card
 * hub against a login form — reporting twelve missing sections that are not
 * missing at all. That was the single largest source of false findings in the
 * first run.
 *
 * Accounts are provisioned through the service role and signed in through the
 * real /login form, because the cookie the app reads is written by the login
 * handler and reproducing it by hand is how you end up debugging @supabase/ssr
 * instead of the design.
 *
 * The board's roles are not all profile roles: `profiles.role` only accepts
 * admin | contributor. `parent` is simply a signed-in account with no special
 * grant, and `leader` is an account that leads an active organisation.
 */
const path = require('path')
// Resolved from packages/web — this script lives outside any package.
const { createClient } = require(
  require.resolve('@supabase/supabase-js', {
    paths: [path.resolve(__dirname, '../../packages/web')],
  })
)

const SUPABASE_URL = process.env.PARITY_SUPABASE_URL || 'http://localhost:54321'
const SERVICE_KEY =
  process.env.PARITY_SERVICE_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const PASSWORD = 'parity-Password-1'
const admin = () =>
  createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })

const stamp = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`

async function makeUser(db, role, name) {
  const email = `parity-${role}-${stamp()}@example.com`
  const { data, error } = await db.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name },
  })
  if (error || !data.user) throw new Error(`create ${role}: ${error?.message}`)

  // profiles.role only accepts admin|contributor; everything else is a
  // contributor with extra grants elsewhere.
  const profileRole = role === 'admin' ? 'admin' : 'contributor'
  const { error: pErr } = await db
    .from('profiles')
    .upsert({ id: data.user.id, role: profileRole, name })
  if (pErr) throw new Error(`profile ${role}: ${pErr.message}`)

  return { id: data.user.id, email, password: PASSWORD }
}

/**
 * Accept every terms flavour, so /onboarding/contributor-terms never stands in
 * for the screen under comparison.
 *
 * Throws rather than swallowing. The first version of this wrote to a
 * non-existent table and ignored the error, and the harness then compared the
 * board's twelve-card hub against the terms gate and reported twelve missing
 * sections — a wrong report that looked exactly like a right one. A fixture
 * that fails silently is worse than no fixture.
 */
async function acceptAllTerms(db, userId) {
  for (const type of ['contributor_terms', 'org_leader_terms']) {
    const { error } = await db
      .from('user_agreements')
      .insert({ user_id: userId, agreement_type: type, version: 'v0-todo' })
    if (error) throw new Error(`acceptTerms(${type}): ${error.message}`)
  }
}

/** Provision one account per role. Returns { role: {email, password, id} }. */
async function provision(roles) {
  const db = admin()
  const users = {}
  for (const role of roles) {
    const u = await makeUser(db, role, `Parity ${role}`)
    await acceptAllTerms(db, u.id)
    if (role === 'leader') {
      const { data, error } = await db
        .from('organizations')
        .insert({ name: `Parity Org ${stamp()}`, status: 'active' })
        .select('id')
        .single()
      if (error) throw new Error(`org: ${error.message}`)
      const { error: lErr } = await db
        .from('org_leaders')
        .insert({ org_id: data.id, user_id: u.id })
      if (lErr) throw new Error(`org_leader: ${lErr.message}`)
      u.orgId = data.id
    }
    users[role] = u
  }
  return users
}

/**
 * Sign a context in through the real login form.
 *
 * Waits for the URL to leave /login rather than for the click to resolve: the
 * handler awaits signInWithPassword, a getUser and a profile read before it
 * sets window.location, so the auth cookie is not written when click() returns.
 */
async function signIn(context, liveOrigin, user) {
  const page = await context.newPage()
  try {
    await page.goto(`${liveOrigin}/login`, { waitUntil: 'domcontentloaded' })

    // Fill AFTER hydration, and check the value stuck.
    //
    // These are controlled inputs: fill() writes the DOM value, and if React
    // hydrates a moment later it resets them to ''. The form then posts an
    // empty email and GoTrue answers "missing email or phone". It reproduced
    // only under load — one context signed in fine, two did not — which is
    // exactly the kind of race that makes a parity report wrong intermittently.
    await page.waitForLoadState('networkidle').catch(() => {})
    for (let attempt = 0; attempt < 4; attempt++) {
      await page.locator('#email').fill(user.email)
      await page.locator('#password').fill(user.password)
      const stuck = await page.evaluate(
        (e) => document.querySelector('#email')?.value === e,
        user.email
      )
      if (stuck) break
      await page.waitForTimeout(400)
    }
    await page.getByRole('button', { name: 'Sign in' }).click()
    await page.waitForURL((url) => !new URL(url).pathname.startsWith('/login'), {
      timeout: 30000,
    })
    return { ok: true }
  } catch (err) {
    // Report why. Returning a bare false here cost an hour: the real cause was
    // a visible error message on the form, and the harness was reporting the
    // resulting /login page as a design finding.
    let formError = null
    try {
      formError = await page.evaluate(
        () => document.querySelector('[role="alert"], .error, [data-error]')?.textContent?.trim() || null
      )
    } catch {
      /* page may be gone */
    }
    return { ok: false, reason: formError || String(err.message || err).slice(0, 160) }
  } finally {
    await page.close()
  }
}

/** Remove the accounts this run created. Best-effort. */
async function cleanup(users) {
  const db = admin()
  for (const u of Object.values(users)) {
    if (u.orgId) await db.from('organizations').delete().eq('id', u.orgId).then(() => {}, () => {})
    await db.auth.admin.deleteUser(u.id).then(() => {}, () => {})
  }
}

module.exports = { provision, signIn, cleanup }
