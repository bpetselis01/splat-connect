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
 * A published toy ready to request, seeded through the service role like
 * createTutorial — the owner's create/edit/publish flow has its own coverage
 * in dashboard/toys.spec.ts, so exchange specs start from a toy that already
 * exists.
 */
export async function createPublishedToy(
  ownerId: string,
  overrides: Partial<{ name: string; offer_type: 'donation' | 'exchange' | 'both' }> = {}
): Promise<string> {
  const supabase = adminClient()
  const { data, error } = await supabase
    .from('toys')
    .insert({
      owner_id: ownerId,
      name: overrides.name ?? 'Test toy',
      condition: 7,
      cover_photo_url: 'https://example.com/cover.jpg',
      status: 'published',
      offer_type: overrides.offer_type ?? 'donation',
    })
    .select('id')
    .single()
  if (error) throw new Error(`createPublishedToy failed: ${error.message}`)
  return data.id
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
    /** null renders the 🧸 placeholder instead of a photo. */
    toyPhotoUrl: string | null
    /** false leaves tutorial_pdf_url null, which makes the tutorial incomplete. */
    withPdf: boolean
    /** false omits the STL row, so the detail page drops its 3D-print section. */
    withStl: boolean
    /** true adds one optional part and one optional tool alongside the required pair. */
    withOptionalExtras: boolean
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
    tutorial_pdf_url:
      overrides.withPdf === false ? null : 'https://placeholder.invalid/tutorial.pdf',
    toy_photo_url:
      overrides.toyPhotoUrl === undefined
        ? 'https://placeholder.invalid/photo.jpg'
        : overrides.toyPhotoUrl,
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

  if (overrides.withStl !== false) {
    await admin.from('stl_files').insert({
      tutorial_id: id,
      filename: 'e2e-mount.stl',
      file_url: 'https://placeholder.invalid/e2e-mount.stl',
    })
  }

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

/** Sign in through the /login form. Caller awaits the resulting redirect. */
/**
 * Record a terms acceptance for a user, through the service role.
 *
 * POST /api/tutorials and the draft -> pending transition both refuse a
 * contributor who has accepted nothing, so any spec that creates or submits a
 * tutorial needs this. Deliberately NOT folded into createContributor: the gate
 * is real behaviour, and hiding it in the fixture would make it untestable.
 */
export async function acceptTerms(
  userId: string,
  type: 'contributor_terms' | 'org_leader_terms' = 'contributor_terms'
) {
  const { error } = await adminClient()
    .from('user_agreements')
    .insert({ user_id: userId, agreement_type: type, version: 'v0-todo' })
  if (error) throw new Error(`acceptTerms failed: ${error.message}`)
}

/**
 * Provision an active organisation with one leader, through the service role.
 *
 * Both writes are admin-only by policy, and creating them here rather than
 * clicking through /admin/organizations keeps a test that is about the backing
 * journey from also being a test of the admin form.
 *
 * Returns the new organisation's id.
 */
export async function createOrgWithLeader(leaderId: string, name: string) {
  const admin = adminClient()
  const { data, error } = await admin
    .from('organizations')
    .insert({ name, status: 'active' })
    .select('id')
    .single()
  if (error) throw new Error(`createOrgWithLeader failed: ${error.message}`)

  const { error: leaderError } = await admin
    .from('org_leaders')
    .insert({ org_id: data.id, user_id: leaderId })
  if (leaderError) throw new Error(`createOrgWithLeader leader failed: ${leaderError.message}`)
  return data.id as string
}

/**
 * Seed a pending backing request from an author to an organisation.
 *
 * Through the service role rather than the API, for the same reason
 * createTutorial seeds a tutorial: the author's request path has its own
 * integration coverage, and a browser-context request would carry whichever
 * user is currently signed in.
 */
export async function seedBackingRequest(tutorialId: string, orgId: string) {
  const { error } = await adminClient()
    .from('tutorial_orgs')
    .insert({ tutorial_id: tutorialId, org_id: orgId, status: 'pending' })
  if (error) throw new Error(`seedBackingRequest failed: ${error.message}`)
}

/**
 * A project already published by an organisation's leader — the state the admin's
 * unpublish journey starts from, without replaying the leader's five clicks.
 *
 * Writes through the service role, which the provenance trigger lets past on its
 * `auth.uid() is null` arm. A user JWT here would be refused unless it belonged to
 * a leader of that very organisation, which is the point of the trigger.
 */
export async function seedLeaderApproval(
  tutorialId: string,
  orgId: string,
  leaderId: string
) {
  const db = adminClient()
  const { error: backing } = await db
    .from('tutorial_orgs')
    .insert({ tutorial_id: tutorialId, org_id: orgId, status: 'accepted' })
  if (backing) throw new Error(`seedLeaderApproval backing failed: ${backing.message}`)

  const { error } = await db
    .from('tutorials')
    .update({ status: 'approved', reviewed_by: leaderId, reviewed_for_org_id: orgId })
    .eq('id', tutorialId)
  if (error) throw new Error(`seedLeaderApproval failed: ${error.message}`)
}

/** Organisations cascade to org_leaders and tutorial_orgs, so this is enough. */
export async function deleteOrg(orgId: string) {
  await adminClient().from('organizations').delete().eq('id', orgId)
}

export async function signIn(page: Page, email: string, password: string) {
  await page.goto('/login')
  await page.locator('#email').fill(email)
  await page.locator('#password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
}
