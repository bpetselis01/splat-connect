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
    /** Column default is 'toy_adaptation' (048_tutorial_kind.sql). */
    kind: 'toy_adaptation' | 'assistive_tech'
    /** false leaves tutorial_pdf_url null, so the preview screen has nothing to open. */
    withPdf: boolean
    /** true adds one optional part and one optional tool alongside the required pair. */
    withOptionalExtras: boolean
    /**
     * Renames the primary contributor's profile, so the byline and the
     * contributor showcase carry a string this spec alone can assert on —
     * every createContributor() otherwise answers to "E2E Contributor", and
     * four parallel workers share that name.
     */
    contributorName: string
    /** Creates an active organisation of this name and an ACCEPTED backing row. */
    backedByOrg: string
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
    kind: overrides.kind ?? 'toy_adaptation',
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

  // tutorial_contributors is (tutorial_id, profile_id, role, added_at) with a
  // composite primary key — no id column, and role is checked against
  // ('primary','collaborator'). See 001_schema.sql.
  const { error: linkError } = await admin
    .from('tutorial_contributors')
    .insert({ tutorial_id: id, profile_id: contributorId, role: 'primary' })
  if (linkError) throw new Error(`Failed to link tutorial contributor: ${linkError.message}`)

  if (overrides.contributorName) {
    // The service role passes freeze_profile_identity()'s `auth.uid() is null`
    // early return (045), so this is a plain update — no trigger to work around.
    const { error: nameError } = await admin
      .from('profiles')
      .update({ name: overrides.contributorName })
      .eq('id', contributorId)
    if (nameError) throw new Error(`Failed to rename contributor: ${nameError.message}`)
  }

  if (overrides.backedByOrg) {
    // organizations needs name + status ('active' | 'suspended'); tutorial_orgs
    // is (tutorial_id, org_id, status, requested_at, ...) and only an ACCEPTED
    // row is public — the list and detail routes filter the embed to it.
    const { data: org, error: orgError } = await admin
      .from('organizations')
      .insert({ name: overrides.backedByOrg, status: 'active' })
      .select('id')
      .single()
    if (orgError || !org) throw new Error(`Failed to create organisation: ${orgError?.message}`)
    const { error: backingError } = await admin
      .from('tutorial_orgs')
      .insert({ tutorial_id: id, org_id: org.id, status: 'accepted' })
    if (backingError) throw new Error(`Failed to back tutorial: ${backingError.message}`)
  }

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

/**
 * A published toy owned by one person, inserted straight through the service
 * role. Deliberately not driven through the UI: POST /api/toys publishes only
 * after the photo gaps are filled (routes/toys.ts), and a read-side spec has
 * no business uploading a cover photo to get a row into the library.
 *
 * Mirrors packages/web/tests/e2e/helpers.ts createPublishedToy, plus the
 * overrides the mobile library screen filters and badges on. Every optional
 * fact defaults OFF — no switch adaptation, no photo — so a spec that asserts
 * one of them has to have asked for it.
 */
export async function createPublishedToy(
  ownerId: string,
  overrides: Partial<{
    name: string
    /** 1–10. The library's condition buckets cut at 3/4 and 6/7. */
    condition: number
    /** null lists the toy without offering it — the request block's "not offered" branch. */
    offer_type: 'donation' | 'exchange' | 'both' | null
    switch_adapted: boolean
    cover_photo_url: string
  }> = {}
): Promise<string> {
  const { data, error } = await adminClient()
    .from('toys')
    .insert({
      owner_id: ownerId,
      name: overrides.name ?? uniqueTitle('E2E Toy'),
      condition: overrides.condition ?? 7,
      switch_adapted: overrides.switch_adapted ?? false,
      cover_photo_url: overrides.cover_photo_url ?? null,
      // `in` rather than `??`: null is a meaningful value here, not an absence.
      offer_type: 'offer_type' in overrides ? overrides.offer_type : 'donation',
      status: 'published',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createPublishedToy failed: ${error?.message}`)
  return data.id
}

/** Rename a service-role-provisioned profile, so a spec can assert on a name
 *  only its own fixture answers to — every createContributor() is otherwise
 *  "E2E Contributor", and four parallel workers share that. */
export async function renameProfile(profileId: string, name: string) {
  const { error } = await adminClient().from('profiles').update({ name }).eq('id', profileId)
  if (error) throw new Error(`renameProfile failed: ${error.message}`)
}

/** Seed the saved pickup address the exchange thread pre-fills its accept form
 *  from (caps.profile.pickup_*). */
export async function setPickupAddress(
  profileId: string,
  address: { pickup_line1: string; pickup_suburb: string; pickup_state: string; pickup_postcode: string }
) {
  const { error } = await adminClient().from('profiles').update(address).eq('id', profileId)
  if (error) throw new Error(`setPickupAddress failed: ${error.message}`)
}

/**
 * The handoff codes as the database holds them. The thread shows each party
 * only their OWN code (sanitizeCodes in routes/toy-transactions.ts), so the
 * side doing the confirming can never read the code it has to type — in real
 * life it is read aloud at the pickup, and here it comes from the row.
 */
export async function handoffCodes(transactionId: string) {
  const { data, error } = await adminClient()
    .from('toy_transactions')
    .select('owner_code, requester_code')
    .eq('id', transactionId)
    .single()
  if (error || !data) throw new Error(`handoffCodes failed: ${error?.message}`)
  return data as { owner_code: string; requester_code: string }
}

/**
 * A published design challenge, straight into toy_ideas at status 'challenge'
 * — the status GET /api/public/challenges filters to. Going through the real
 * submit-then-admin-approve path would need an admin account and two screens
 * for a row every challenge spec needs as a precondition, not as its subject.
 */
export async function createChallenge(
  authorId: string,
  overrides: Partial<{
    title: string
    summary: string
    /** 'graduated' puts it under "Solved · became guides" instead. */
    status: 'challenge' | 'graduated' | 'pending' | 'rejected'
    contact_prefs: ('clarification' | 'co_design' | 'user_testing')[]
  }> = {}
): Promise<string> {
  const { data, error } = await adminClient()
    .from('toy_ideas')
    .insert({
      author_id: authorId,
      title: overrides.title ?? uniqueTitle('E2E Challenge'),
      summary: overrides.summary ?? 'Seeded by a Playwright E2E test.',
      description: 'The toy resists every switch we have tried.',
      intended_use: 'A bubble machine during therapy.',
      primary_user: 'A three-year-old with low muscle tone.',
      contact_prefs: overrides.contact_prefs ?? [],
      status: overrides.status ?? 'challenge',
    })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createChallenge failed: ${error?.message}`)
  return data.id
}

/**
 * One notification, as the API's own handlers write them: the row carries the
 * subject id its COPY line and its link both read (idea_id, tutorial_id or
 * toy_transaction_id), never all three.
 */
export async function createNotification(
  recipientId: string,
  fields: {
    type: string
    actor_name?: string
    tutorial_id?: string
    tutorial_title?: string
    toy_transaction_id?: string
    toy_name?: string
    idea_id?: string
  }
): Promise<string> {
  const { data, error } = await adminClient()
    .from('notifications')
    .insert({ recipient_id: recipientId, actor_name: 'E2E Actor', ...fields })
    .select('id')
    .single()
  if (error || !data) throw new Error(`createNotification failed: ${error?.message}`)
  return data.id
}
