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

const admin = createClient(
  process.env.SUPABASE_URL ?? 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
)

// Both synthetic domains: @splat-test.local is the API suite's, @web-e2e.local
// the Playwright helpers'. The latter produces the bulk of the residue and was
// missed entirely, which is why cleanup never kept up.
const TEST_DOMAINS = ['@splat-test.local', '@web-e2e.local']
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

// The toy tables reference profiles with NO ACTION rather than a cascade, so a
// test user who ever listed a toy cannot be deleted until their rows go first.
// Every other table cascades, which is why this only bites here.
async function purgeToyData(ids: string[]) {
  for (let i = 0; i < ids.length; i += 200) {
    const batch = ids.slice(i, i + 200)
    const { data: txs } = await admin
      .from('toy_transactions')
      .select('id')
      .or(`owner_id.in.(${batch.join(',')}),requester_id.in.(${batch.join(',')})`)
    const txIds = (txs ?? []).map((t: { id: string }) => t.id)
    if (txIds.length) {
      await admin.from('toy_transaction_messages').delete().in('transaction_id', txIds)
      await admin.from('toy_transactions').delete().in('id', txIds)
    }
    await admin.from('toy_transaction_messages').delete().in('sender_id', batch)
    await admin.from('toys').delete().in('owner_id', batch)
  }
}

const testUsers = await allTestUsers()
console.log(`Found ${testUsers.length} test users to delete`)

await purgeToyData(testUsers.map((u) => u.id))

let deleted = 0
for (const user of testUsers) {
  const { error } = await admin.auth.admin.deleteUser(user.id)
  if (error) console.error(`Failed ${user.email}: ${error.message}`)
  else deleted++
  if (deleted % 100 === 0) console.log(`Deleted ${deleted}/${testUsers.length}`)
}
console.log(`Deleted ${deleted} of ${testUsers.length}`)
