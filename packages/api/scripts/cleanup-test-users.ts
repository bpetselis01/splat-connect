/**
 * Deletes the accounts the test suites leave behind, and their content with
 * them via the profile cascade.
 *
 * Only local matters: CI runs `supabase db reset` and starts clean, so a local
 * database is the only one that accumulates. Left alone it degrades every long
 * run — a full e2e pass adds ~90 accounts, and once there are enough of them
 * queries slow until 90s specs time out and auth calls start failing. That
 * shows up as unrelated specs flaking differently on every run.
 */
import { createClient } from '@supabase/supabase-js'
import { config } from 'dotenv'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

// `pnpm test:cleanup` runs plain tsx, so nothing loads .env.test the way the
// vitest suites do through tests/integration/setup.ts — the empty-string key
// default made every invocation throw "supabaseKey is required" before it
// deleted anything. Same load as that setup file, for the same local stack.
const __dirname = path.dirname(fileURLToPath(import.meta.url))
config({ path: path.resolve(__dirname, '../.env.test'), override: true })

const admin = createClient(
  process.env.SUPABASE_URL ?? 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
)

// All three synthetic domains, one per suite: @splat-test.local is the API
// integration suite's, @web-e2e.local the web Playwright helpers', and
// @mobile-e2e.local the mobile Playwright helpers'. Every domain missing from
// this list is residue nothing can reach — @web-e2e.local was the bulk of it
// and @mobile-e2e.local was still unlisted after that, so check this list
// whenever a suite starts minting its own accounts.
const TEST_DOMAINS = ['@splat-test.local', '@web-e2e.local', '@mobile-e2e.local']
const PER_PAGE = 1000

// listUsers pages at 50 by default, so the old single call could not clear more
// than 50 accounts however often it was run.
async function allTestUsers() {
  const found: Array<{ id: string; email: string }> = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: PER_PAGE })
    if (error) {
      console.error(error)
      process.exit(1)
    }
    for (const user of data.users) {
      if (user.email && TEST_DOMAINS.some((d) => user.email!.endsWith(d))) {
        found.push({ id: user.id, email: user.email })
      }
    }
    if (data.users.length < PER_PAGE) return found
  }
}

const testUsers = await allTestUsers()
console.log(`Found ${testUsers.length} test users to delete`)

let deleted = 0
for (const user of testUsers) {
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) console.error(`Failed ${user.email}: ${error.message}`)
  else deleted++
  if (deleted % 100 === 0) console.log(`Deleted ${deleted}/${testUsers.length}`)
}

// tutorials is the one table the profile cascade cannot reach — it carries no
// FK to profiles, so deleting a suite's accounts strands their tutorials for
// good. 1,879 had piled up by the time anyone looked, which is the same slow
// rot the accounts caused. A tutorial with no contributor row left is orphaned
// by definition: that seat table does cascade, so the last seat disappears
// with the last owner. The hour of grace is for a tutorial someone just
// created by hand — POST /api/tutorials inserts the row and the contributor
// seat follows a moment later, and a run in that gap would eat it.
async function purgeOrphanTutorials() {
  const rows: Array<{ id: string; created_at: string }> = []
  // PostgREST caps a response at max_rows (1000 in config.toml), so page it.
  for (let from = 0; ; from += PER_PAGE) {
    const { data, error } = await admin
      .from('tutorials')
      .select('id, created_at')
      .range(from, from + PER_PAGE - 1)
    if (error) {
      console.error(error)
      return
    }
    rows.push(...(data ?? []))
    if (!data || data.length < PER_PAGE) break
  }

  const seated = new Set<string>()
  for (let from = 0; ; from += PER_PAGE) {
    const { data, error } = await admin
      .from('tutorial_contributors')
      .select('tutorial_id')
      .range(from, from + PER_PAGE - 1)
    if (error) {
      console.error(error)
      return
    }
    for (const seat of data ?? []) seated.add(seat.tutorial_id)
    if (!data || data.length < PER_PAGE) break
  }

  const cutoff = Date.now() - 60 * 60 * 1000
  const orphans = rows
    .filter((t) => !seated.has(t.id) && new Date(t.created_at).getTime() < cutoff)
    .map((t) => t.id)

  for (let i = 0; i < orphans.length; i += 200) {
    const { error } = await admin.from('tutorials').delete().in('id', orphans.slice(i, i + 200))
    if (error) console.error(error)
  }
  console.log(`Deleted ${orphans.length} orphaned tutorials`)
}

await purgeOrphanTutorials()
console.log(`Deleted ${deleted} of ${testUsers.length}`)
