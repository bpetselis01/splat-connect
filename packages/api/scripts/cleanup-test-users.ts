import { createClient } from '@supabase/supabase-js'

const admin = createClient(
  process.env.SUPABASE_URL ?? 'http://localhost:54321',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
)

const { data, error } = await admin.auth.admin.listUsers()
if (error) { console.error(error); process.exit(1) }

const testUsers = data.users.filter((u) => u.email?.endsWith('@splat-test.local'))
console.log(`Found ${testUsers.length} test users to delete`)

for (const user of testUsers) {
  await admin.auth.admin.deleteUser(user.id)
  console.log(`Deleted ${user.email}`)
}
