// Provisions the parent account the Maestro flows sign in as. Maestro flows are
// YAML and cannot reach the service role, so this runs first and emits the
// credentials as KEY=value lines for `maestro test --env`.
//
// Deliberately duplicates createParent() from tests/e2e/helpers.ts rather than
// importing it: that module imports `expect` from @playwright/test (a value, not
// just a type), which a plain Node script has no reason to load. Keep the two in
// sync — the profiles upsert is the part that matters.
import { createClient } from '@supabase/supabase-js'

// Local Supabase — well-known non-secret dev keys, same values as
// playwright.config.ts and tests/e2e/helpers.ts.
const SUPABASE_URL = process.env.DEVICE_SUPABASE_URL ?? 'http://localhost:54321'
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const PASSWORD = 'Test1234!'
const email = `device-parent-${Date.now()}-${Math.floor(Math.random() * 1e6)}@mobile-e2e.local`

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const { data, error } = await admin.auth.admin.createUser({
  email,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { name: 'Device E2E Parent', role: 'parent' },
})
if (error || !data.user) throw new Error(`Failed to create parent: ${error?.message}`)

// The role on `profiles` is what GET /api/contributors/me returns, and it is
// what makes the Profile tab render ChildProfileHome instead of the sign-in card.
const { error: profileError } = await admin
  .from('profiles')
  .upsert({ id: data.user.id, role: 'parent', name: 'Device E2E Parent' })
if (profileError) throw new Error(`Failed to set parent profile: ${profileError.message}`)

// Two lines only, so callers can `eval $(node …)` or append to $GITHUB_ENV.
console.log(`DEVICE_EMAIL=${email}`)
console.log(`DEVICE_PASSWORD=${PASSWORD}`)
