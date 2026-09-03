import { adminClient } from './auth.js'

/** Service-role fixture builders. Tests exercise policies through a user client;
 *  setup deliberately bypasses RLS so a broken policy fails the assertion, not
 *  the arrangement. */
export async function createOrg(opts: {
  createdBy: string
  status?: 'active' | 'suspended'
  name?: string
}): Promise<string> {
  const { data, error } = await adminClient()
    .from('organizations')
    .insert({
      name: opts.name ?? `Test Org ${crypto.randomUUID().slice(0, 8)}`,
      created_by: opts.createdBy,
      status: opts.status ?? 'active',
    })
    .select('id')
    .single()
  if (error) throw new Error(`createOrg failed: ${error.message}`)
  return data.id as string
}

export async function addLeader(orgId: string, userId: string): Promise<string> {
  const { data, error } = await adminClient()
    .from('org_leaders')
    .insert({ org_id: orgId, user_id: userId })
    .select('id')
    .single()
  if (error) throw new Error(`addLeader failed: ${error.message}`)
  return data.id as string
}

export async function acceptTerms(userId: string, type: 'contributor_terms' | 'org_leader_terms') {
  const { error } = await adminClient()
    .from('user_agreements')
    .insert({ user_id: userId, agreement_type: type, version: 'v0-todo' })
  if (error) throw new Error(`acceptTerms failed: ${error.message}`)
}

/**
 * A tutorial with its author linked.
 *
 * Unlike the superseded helper this needs no author token: there is no
 * `tutorials.org_id` to pin under the author's own JWT, because backing lives in
 * its own table now. That indirection existed only to satisfy a trigger that no
 * longer exists.
 */
export async function createProject(opts: {
  authorId: string
  status?: 'draft' | 'pending' | 'approved' | 'rejected'
  title?: string
}): Promise<string> {
  const admin = adminClient()
  const id = crypto.randomUUID()
  const { error } = await admin.from('tutorials').insert({
    id,
    title: opts.title ?? 'Backing Fixture',
    difficulty: 'easy',
    status: opts.status ?? 'pending',
  })
  if (error) throw new Error(`createProject failed: ${error.message}`)

  const { error: linkError } = await admin
    .from('tutorial_contributors')
    .insert({ tutorial_id: id, profile_id: opts.authorId })
  if (linkError) throw new Error(`createProject link failed: ${linkError.message}`)
  return id
}

/** A backing request in whatever state the test needs, bypassing the handshake. */
export async function requestBacking(opts: {
  tutorialId: string
  orgId: string
  status?: 'pending' | 'accepted' | 'declined'
  respondedBy?: string
}): Promise<string> {
  const { data, error } = await adminClient()
    .from('tutorial_orgs')
    .insert({
      tutorial_id: opts.tutorialId,
      org_id: opts.orgId,
      status: opts.status ?? 'pending',
      responded_by: opts.respondedBy ?? null,
      responded_at: opts.status && opts.status !== 'pending' ? new Date().toISOString() : null,
    })
    .select('id')
    .single()
  if (error) throw new Error(`requestBacking failed: ${error.message}`)
  return data.id as string
}

/** The fixed pickup point. Written service-role because the only route that
 *  writes it is itself under test elsewhere. */
export async function setOrgPickup(
  orgId: string,
  overrides: Record<string, string | null> = {}
) {
  const { error } = await adminClient()
    .from('organizations')
    .update({
      pickup_line1: '5 Association Way',
      pickup_suburb: 'Northbridge',
      pickup_state: 'NSW',
      pickup_postcode: '2063',
      pickup_instructions: 'Reception, ground floor. Ask for the toy library.',
      ...overrides,
    })
    .eq('id', orgId)
  if (error) throw new Error(`setOrgPickup failed: ${error.message}`)
}

/** Published org stock, ready to be requested. `quantity` is the whole point:
 *  a person's toy cannot hold more than 1, so this is the only way to make a
 *  toy several families can be mid-handoff on at once. */
export async function createOrgToy(opts: {
  orgId: string
  quantity?: number
  offerType?: 'donation' | 'exchange' | 'both'
  name?: string
  status?: 'draft' | 'published'
}): Promise<string> {
  const { data, error } = await adminClient()
    .from('toys')
    .insert({
      name: opts.name ?? `Sensory Bear ${crypto.randomUUID().slice(0, 8)}`,
      condition: 8,
      owner_id: null,
      owner_org_id: opts.orgId,
      quantity: opts.quantity ?? 1,
      offer_type: opts.offerType ?? 'donation',
      photo_urls: ['https://example.com/bear.jpg'],
      status: opts.status ?? 'published',
    })
    .select('id')
    .single()
  if (error) throw new Error(`createOrgToy failed: ${error.message}`)
  return data.id as string
}

/** `tutorial_orgs` rows go with either parent via cascade, so they need no
 *  explicit delete here. */
export async function cleanupOrg(orgId: string, tutorialIds: string[] = []) {
  const admin = adminClient()
  if (tutorialIds.length) await admin.from('tutorials').delete().in('id', tutorialIds)
  await admin.from('org_leaders').delete().eq('org_id', orgId)
  // Toys and their transactions cascade from the organisation (033), so only
  // the org row needs deleting — but the toys a handoff MINTED belong to a
  // person and do not, which is why toy suites also delete their test users.
  await admin.from('organizations').delete().eq('id', orgId)
}
