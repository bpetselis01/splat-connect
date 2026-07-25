import { type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// Local Supabase — well-known, non-secret dev keys (same as playwright.config.ts).
const SUPABASE_URL = 'http://localhost:54321'
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const PASSWORD = 'Test1234!'

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@web-e2e.local`
}

/** Unique contributor email per invocation so runs don't collide (CI does `supabase db reset`). */
export function uniqueContributorEmail() {
  return uniqueEmail('contrib')
}

/**
 * Unique per invocation even within the same millisecond. Four parallel workers
 * collide on `Date.now()` alone, and a duplicated title makes one spec's
 * assertions match another's fixture.
 */
export function uniqueTitle(prefix: string) {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

const CONTRIBUTOR_NAME = 'E2E Contributor'

/** Service-role client for E2E fixture setup. */
export function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
}

/** Provision a confirmed contributor directly via the service role. Returns credentials for signing in through the UI. */
export async function createContributor() {
  const admin = adminClient()
  const email = uniqueEmail('contrib')
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: CONTRIBUTOR_NAME },
  })
  if (error || !data.user) throw new Error(`Failed to create contributor: ${error?.message}`)

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: data.user.id, role: 'contributor', name: CONTRIBUTOR_NAME })
  if (profileError) throw new Error(`Failed to set contributor profile: ${profileError.message}`)

  return { id: data.user.id, email, password: PASSWORD, name: CONTRIBUTOR_NAME }
}

/**
 * Provision a confirmed admin via the service role. The signup trigger defaults
 * new accounts to the contributor role, so the role is set explicitly here.
 */
export async function createAdmin() {
  const admin = adminClient()
  const email = uniqueEmail('admin')
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'E2E Admin' },
  })
  if (error || !data.user) throw new Error(`Failed to create admin: ${error?.message}`)

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: data.user.id, role: 'admin', name: 'E2E Admin' })
  if (profileError) throw new Error(`Failed to set admin profile: ${profileError.message}`)

  return { id: data.user.id, email, password: PASSWORD }
}

/**
 * Best-effort teardown. CI boots a fresh Supabase per job, so leaked fixtures
 * cost nothing there; this keeps repeated local runs from accumulating accounts.
 * No assertion may depend on this having run.
 */
export async function deleteUser(id: string) {
  await adminClient().auth.admin.deleteUser(id)
}

/**
 * Provision a throwaway tutorial (with one part and one tool, so it's a
 * complete record) linked to the given contributor as the primary owner.
 * Returns the new tutorial's id.
 */
export async function createTutorial(
  contributorId: string,
  overrides: Partial<{
    title: string
    status: 'draft' | 'pending' | 'approved' | 'rejected'
    difficulty: 'easy' | 'medium' | 'hard'
    rejection_note: string | null
  }> = {}
) {
  const admin = adminClient()
  const id = crypto.randomUUID()

  const { error } = await admin.from('tutorials').insert({
    id,
    title: overrides.title ?? `E2E Tutorial ${id.slice(0, 8)}`,
    description: 'Created by a Playwright E2E test.',
    difficulty: overrides.difficulty ?? 'easy',
    status: overrides.status ?? 'pending',
    tutorial_pdf_url: 'https://placeholder.invalid/tutorial.pdf',
    toy_photo_url: 'https://placeholder.invalid/photo.jpg',
    rejection_note: overrides.rejection_note ?? null,
  })
  if (error) throw new Error(`Failed to create tutorial: ${error.message}`)

  const { error: linkError } = await admin
    .from('tutorial_contributors')
    .insert({ tutorial_id: id, profile_id: contributorId, role: 'primary' })
  if (linkError) throw new Error(`Failed to link tutorial contributor: ${linkError.message}`)

  // A buy link and an STL row so the public detail spec has something to assert
  // on. Additive: no existing spec asserts on part, tool or STL counts.
  await admin.from('parts').insert({
    tutorial_id: id,
    name: 'E2E part',
    quantity: 2,
    is_optional: false,
    buy_links: [{ label: 'Jaycar', url: 'https://example.com/part' }],
  })
  await admin.from('tools').insert({ tutorial_id: id, name: 'E2E tool', is_optional: false, buy_links: [] })
  await admin.from('stl_files').insert({
    tutorial_id: id,
    filename: 'e2e-mount.stl',
    file_url: 'https://placeholder.invalid/e2e-mount.stl',
  })

  return id
}

/** Sign in through the /login form. Caller awaits the resulting redirect. */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}
