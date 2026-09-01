// Provisions the account the Maestro flows sign in as. Maestro flows are
// YAML and cannot reach the service role, so this runs first and emits the
// credentials as KEY=value lines for `maestro test --env`.
//
// Deliberately duplicates createContributor() + acceptTerms() from
// tests/e2e/helpers.ts rather than importing them: that module imports
// `expect` from @playwright/test (a value, not just a type), which a plain
// Node script has no reason to load. Keep the two in sync.
//
// No role in the metadata and no profiles upsert: the signup trigger defaults
// every account to 'contributor', and migration 011 removed the 'parent' role
// this script used to write (the constraint now rejects it).
import { createClient } from '@supabase/supabase-js'

// Local Supabase by default — well-known non-secret dev keys, same values as
// playwright.config.ts and tests/e2e/helpers.ts. Point DEVICE_SUPABASE_URL and
// DEVICE_SERVICE_ROLE_KEY elsewhere to provision on another project.
const SUPABASE_URL = process.env.DEVICE_SUPABASE_URL ?? 'http://localhost:54321'
const SERVICE_ROLE_KEY =
  process.env.DEVICE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const PASSWORD = 'Test1234!'
const email = `device-parent-${Date.now()}-${Math.floor(Math.random() * 1e6)}@mobile-e2e.local`

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

const { data, error } = await admin.auth.admin.createUser({
  email,
  password: PASSWORD,
  email_confirm: true,
  user_metadata: { name: 'Device E2E Parent' },
})
if (error || !data.user) throw new Error(`Failed to create account: ${error?.message}`)

const { error: termsError } = await admin
  .from('user_agreements')
  .insert({ user_id: data.user.id, agreement_type: 'contributor_terms', version: 'v0-todo' })
if (termsError) throw new Error(`Failed to accept terms: ${termsError.message}`)

// One notification, so the Inbox smoke flow renders a real row. An empty inbox
// renders no rows, and rows are where the 2026-09-01 Hermes crash lived —
// asserting on an empty screen would smoke-test nothing. notifications_one_subject
// demands exactly one subject id, so seed a minimal idea to point at (same
// shape as createChallenge in tests/e2e/helpers.ts).
const { data: idea, error: ideaError } = await admin
  .from('toy_ideas')
  .insert({
    author_id: data.user.id,
    title: `Device smoke idea ${Date.now()}`,
    summary: 'Seeded by provision-device-parent for the Maestro smoke flow.',
    description: 'The toy resists every switch we have tried.',
    intended_use: 'A bubble machine during therapy.',
    primary_user: 'A three-year-old with low muscle tone.',
    contact_prefs: [],
    status: 'challenge',
  })
  .select('id')
  .single()
if (ideaError || !idea) throw new Error(`Failed to seed idea: ${ideaError?.message}`)

const { error: noteError } = await admin
  .from('notifications')
  .insert({ recipient_id: data.user.id, type: 'idea_approved', idea_id: idea.id, actor_name: 'Maestro' })
if (noteError) throw new Error(`Failed to seed notification: ${noteError.message}`)

// Two lines only, so callers can `eval $(node …)` or append to $GITHUB_ENV.
console.log(`DEVICE_EMAIL=${email}`)
console.log(`DEVICE_PASSWORD=${PASSWORD}`)
