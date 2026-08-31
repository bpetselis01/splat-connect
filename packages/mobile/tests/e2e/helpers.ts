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

/** Unique signup email per invocation so runs don't collide (CI does `supabase db reset`). */
export function uniqueSignupEmail() {
  return uniqueEmail('signup')
}

/** Service-role client for E2E fixture setup. */
export function adminClient() {
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
 * for signing in through the UI.
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
  await acceptTerms(data.user.id)
  return { id: data.user.id, email, password: PASSWORD }
}

/**
 * A contributor, signed in through the UI. Every tab lives behind the sign-in
 * gate (app/(tabs)/_layout.tsx), so a spec that only provisions an account and
 * then visits a tab lands on the sign-in screen instead.
 */
export async function signInAsNewContributor(page: Page) {
  const contributor = await createContributor()
  await signIn(page, contributor.email, contributor.password)
  await expect(page).toHaveURL(/\/guides$/)
  return contributor
}

/** Record contributor-terms acceptance for a service-role-provisioned user. */
export async function acceptTerms(userId: string) {
  const { error } = await adminClient()
    .from('user_agreements')
    .insert({ user_id: userId, agreement_type: 'contributor_terms', version: 'v0-todo' })
  if (error) throw new Error(`acceptTerms failed: ${error.message}`)
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
  const pdfPath = overrides.withPdf === false ? null : `${id}/tutorial.pdf`

  const { error } = await admin.from('tutorials').insert({
    id,
    title: overrides.title ?? uniqueTitle('E2E Tutorial'),
    description: 'Created by a Playwright E2E test.',
    difficulty: overrides.difficulty ?? 'easy',
    status: overrides.status ?? 'approved',
    tutorial_pdf_url: pdfPath,
    toy_photo_url: 'https://placeholder.invalid/photo.jpg',
  })
  if (error) throw new Error(`Failed to create tutorial: ${error.message}`)

  // The column holds a path, and the preview signs it before opening it
  // (detail-screen.tsx openPreview). Signing a path with no object behind it
  // fails and the screen falls back to its no-PDF state, so a fixture that
  // sets the column has to put a file there too.
  if (pdfPath) {
    const { error: uploadError } = await admin.storage
      .from('tutorial-pdfs')
      .upload(pdfPath, new Blob(['%PDF-1.4 E2E'], { type: 'application/pdf' }))
    if (uploadError) throw new Error(`Failed to upload tutorial PDF: ${uploadError.message}`)
  }

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
 * Sign up a fresh account. Local Supabase requires email confirmation
 * (supabase/config.toml enable_confirmations=true), so signUp leaves no
 * session — confirm out of band via the admin API, the same as a real
 * confirmation-link click would, then sign in through the UI.
 *
 * Returns on the Guides landing and goes no further: Account lives behind the
 * MY SPLAT modal stack now, so a caller that wants child-profile content asks
 * for it with openChildProfile().
 */
export async function signUpNewAccount(page: Page, email: string) {
  await page.goto('/sign-in')
  await page.getByText('Create an account').click()
  await page.getByPlaceholder('Name').fill('E2E Contributor')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password', { exact: true }).fill(PASSWORD)
  await page.getByPlaceholder('Confirm Password').fill(PASSWORD)
  await page.getByTestId('accept-contributor-terms').click()

  const [signupResponse] = await Promise.all([
    page.waitForResponse(
      (res) => res.url().includes('/auth/v1/signup') && res.request().method() === 'POST'
    ),
    page.getByText('Sign Up').click(),
  ])
  const body = await signupResponse.json()
  const userId = body.user?.id ?? body.id
  await adminClient().auth.admin.updateUserById(userId, { email_confirm: true })

  await page.getByText('Back to sign in').click()
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(PASSWORD)
  await page.getByText('Sign In', { exact: true }).click()
  await expect(page).toHaveURL(/\/guides$/)
}

/**
 * Open Account on its Child Profile segment. Account is a (my) modal route,
 * reachable from any tab, so going straight to the URL is the same thing the
 * MY SPLAT popover does — with none of the popover's animation to wait on.
 */
export async function openChildProfile(page: Page) {
  await page.goto('/account')
  // Account is the default segment on first visit.
  await page.getByText('Child Profile').click()
  await expect(page.getByText('Customization Metrics')).toBeVisible()
}

/** Sign in through the sign-in screen (it defaults to sign-in mode). */
export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/sign-in')
  await page.getByPlaceholder('Email').fill(email)
  await page.getByPlaceholder('Password').fill(password)
  await page.getByText('Sign In', { exact: true }).click()
}

/** From a fresh sign-in, reach one of the three child-profile sub-screens. */
export async function openSubScreen(page: Page, label: 'Ability Profile' | 'Everyday Needs' | 'Customization Metrics') {
  await openChildProfile(page)
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
