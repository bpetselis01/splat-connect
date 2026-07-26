import { type Page, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

// Local Supabase — well-known non-secret dev keys (same as playwright.config.ts).
const SUPABASE_URL = 'http://localhost:54321'
const SERVICE_ROLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU'

const PASSWORD = 'Test1234!'

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@mobile-e2e.local`
}

/** Unique parent email per invocation so runs don't collide (CI does `supabase db reset`). */
export function uniqueParentEmail() {
  return uniqueEmail('parent')
}

/** Service-role client for E2E fixture setup. */
function adminClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
}

/**
 * Unique per invocation even within the same millisecond. Parallel workers
 * collide on `Date.now()` alone, and a duplicated title makes one spec's
 * assertions match another's fixture.
 */
export function uniqueTitle(prefix: string) {
  return `${prefix} ${Date.now()}-${Math.floor(Math.random() * 1e6)}`
}

/**
 * Provision a confirmed contributor directly via the service role (the signup
 * trigger defaults new accounts to the contributor role). Returns credentials
 * for signing in through the UI. Used to exercise the non-parent branch.
 */
export async function createContributor() {
  const admin = adminClient()
  const email = uniqueEmail('contrib')
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'E2E Contributor' },
  })
  if (error || !data.user) throw new Error(`Failed to create contributor: ${error?.message}`)
  return { id: data.user.id, email, password: PASSWORD }
}

/** Provision a confirmed parent via the service role, for specs that don't need the signup UI. */
export async function createParent() {
  const admin = adminClient()
  const email = uniqueEmail('parent')
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { name: 'E2E Parent', role: 'parent' },
  })
  if (error || !data.user) throw new Error(`Failed to create parent: ${error?.message}`)

  const { error: profileError } = await admin
    .from('profiles')
    .upsert({ id: data.user.id, role: 'parent', name: 'E2E Parent' })
  if (profileError) throw new Error(`Failed to set parent profile: ${profileError.message}`)

  return { id: data.user.id, email, password: PASSWORD }
}

/**
 * Provision an approved tutorial with one part and one tool, linked to the given
 * contributor as primary. Mirrors packages/web/tests/e2e/helpers.ts.
 */
export async function createTutorial(
  contributorId: string,
  overrides: Partial<{
    title: string
    status: 'draft' | 'pending' | 'approved' | 'rejected'
    difficulty: 'easy' | 'medium' | 'hard'
    /** false leaves tutorial_pdf_url null, so the preview screen has nothing to open. */
    withPdf: boolean
    /** true adds one optional part and one optional tool alongside the required pair. */
    withOptionalExtras: boolean
  }> = {}
) {
  const admin = adminClient()
  const id = crypto.randomUUID()

  const { error } = await admin.from('tutorials').insert({
    id,
    title: overrides.title ?? uniqueTitle('E2E Tutorial'),
    description: 'Created by a Playwright E2E test.',
    difficulty: overrides.difficulty ?? 'easy',
    status: overrides.status ?? 'approved',
    tutorial_pdf_url:
      overrides.withPdf === false ? null : 'https://placeholder.invalid/tutorial.pdf',
    toy_photo_url: 'https://placeholder.invalid/photo.jpg',
  })
  if (error) throw new Error(`Failed to create tutorial: ${error.message}`)

  const { error: linkError } = await admin
    .from('tutorial_contributors')
    .insert({ tutorial_id: id, profile_id: contributorId, role: 'primary' })
  if (linkError) throw new Error(`Failed to link tutorial contributor: ${linkError.message}`)

  await admin.from('parts').insert({ tutorial_id: id, name: 'E2E part', quantity: 2, is_optional: false, buy_links: [] })
  await admin.from('tools').insert({ tutorial_id: id, name: 'E2E tool', is_optional: false, buy_links: [] })

  if (overrides.withOptionalExtras) {
    await admin
      .from('parts')
      .insert({ tutorial_id: id, name: 'E2E optional part', quantity: 1, is_optional: true, buy_links: [] })
    await admin
      .from('tools')
      .insert({ tutorial_id: id, name: 'E2E optional tool', is_optional: true, buy_links: [] })
  }

  return id
}

/** Best-effort teardown. No assertion may depend on this having run. */
export async function deleteUser(id: string) {
  await adminClient().auth.admin.deleteUser(id)
}

/**
 * Sign up a fresh parent through the Profile-tab UI. Local Supabase has
 * email confirmations disabled, so signUp returns a session immediately and
 * the app lands on the child-profile home.
 */
export async function signUpParent(page: Page, email: string) {
  await page.goto('/profile')
  await page.getByText('Create an account').click()
  await page.getByPlaceholder('Name').fill('E2E Parent')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password', { exact: true }).fill(PASSWORD)
  await page.getByPlaceholder('Confirm Password').fill(PASSWORD)
  await page.getByText('Sign Up').click()
  // Role resolves via GET /api/contributors/me → parent → child-profile home.
  await expect(page.getByText('Customization Metrics')).toBeVisible()
}

/** Sign in through the Profile-tab UI (signed-out screen defaults to sign-in mode). */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/profile')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByText('Sign In', { exact: true }).click()
}

/** From the child-profile home, tap one of the three sub-screen rows. */
export async function openSubScreen(page: Page, label: 'Ability Profile' | 'Everyday Needs' | 'Customization Metrics') {
  await page.getByText(label).click()
}

/**
 * Tap a Dropdown/ChipGroup option and wait for its optimistic selection to
 * commit before returning. Back-to-back programmatic taps can otherwise outrun
 * React's re-render — feeding a stale value to the next tap, or (for a tap that
 * reveals a conditional field) racing that field's mount/unmount.
 */
export async function selectPill(page: Page, name: string) {
  const pill = page.getByRole('button', { name, exact: true })
  await pill.click()
  await expect(pill).toHaveAttribute('aria-selected', 'true')
}
