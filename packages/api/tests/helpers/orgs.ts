import { adminClient } from './auth.js'
import { createUserClient } from '../../src/supabase/user-client.js'

/** Service-role fixture builders. Tests exercise policies through a user client;
 *  setup deliberately bypasses RLS so a broken policy fails the assertion, not
 *  the arrangement. */
export async function createOrg(opts: {
  createdBy: string
  status?: 'pending' | 'approved' | 'suspended'
  trustLevel?: 'probation' | 'trusted'
  name?: string
}): Promise<string> {
  const { data, error } = await adminClient()
    .from('organizations')
    .insert({
      name: opts.name ?? `Test Org ${crypto.randomUUID().slice(0, 8)}`,
      created_by: opts.createdBy,
      status: opts.status ?? 'approved',
      trust_level: opts.trustLevel ?? 'trusted',
    })
    .select('id')
    .single()
  if (error) throw new Error(`createOrg failed: ${error.message}`)
  return data.id as string
}

export async function addMember(opts: {
  orgId: string
  userId: string
  orgRole?: 'leader' | 'member'
  status?: 'pending' | 'approved' | 'removed' | 'declined'
  initiatedBy?: 'contributor' | 'org'
}): Promise<string> {
  const { data, error } = await adminClient()
    .from('org_members')
    .insert({
      org_id: opts.orgId,
      user_id: opts.userId,
      org_role: opts.orgRole ?? 'member',
      status: opts.status ?? 'approved',
      initiated_by: opts.initiatedBy ?? 'org',
    })
    .select('id')
    .single()
  if (error) throw new Error(`addMember failed: ${error.message}`)
  return data.id as string
}

export async function acceptTerms(userId: string, type: 'contributor_terms' | 'org_leader_terms') {
  const { error } = await adminClient()
    .from('user_agreements')
    .insert({ user_id: userId, agreement_type: type, version: 'v0-todo' })
  if (error) throw new Error(`acceptTerms failed: ${error.message}`)
}

/**
 * Creates a tutorial owned by `authorId` and, when `orgId` is given, pins it to
 * that org.
 *
 * WHY the two-step shape: the `tutorials_org_must_be_own` trigger permits a write
 * that sets org_id ONLY from a caller who is an approved member of that org. The
 * service role has no `auth.uid()`, so a service-role insert carrying org_id is
 * refused with 42501 — deliberately, so the rule cannot be bypassed by any
 * server-side code path. The fixture therefore does what production must do:
 * create the row, then pin it under the author's own JWT. This means `authorToken`
 * is required whenever `orgId` is non-null.
 */
export async function createOrgTutorial(opts: {
  orgId: string | null
  authorId: string
  authorToken?: string
  status?: 'draft' | 'pending' | 'approved' | 'rejected'
}): Promise<string> {
  const admin = adminClient()
  const id = crypto.randomUUID()
  const { error } = await admin.from('tutorials').insert({
    id,
    title: 'Org Review Fixture',
    difficulty: 'easy',
    status: opts.status ?? 'pending',
    review_level: opts.orgId ? 'org' : 'platform',
  })
  if (error) throw new Error(`createOrgTutorial failed: ${error.message}`)

  const { error: linkError } = await admin
    .from('tutorial_contributors')
    .insert({ tutorial_id: id, profile_id: opts.authorId })
  if (linkError) throw new Error(`createOrgTutorial link failed: ${linkError.message}`)

  if (opts.orgId) {
    if (!opts.authorToken) {
      throw new Error('createOrgTutorial: authorToken is required when orgId is set')
    }
    const { error: pinError } = await createUserClient(opts.authorToken)
      .from('tutorials')
      .update({ org_id: opts.orgId })
      .eq('id', id)
    if (pinError) throw new Error(`createOrgTutorial pin failed: ${pinError.message}`)
  }
  return id
}

export async function cleanupOrg(orgId: string, tutorialIds: string[] = []) {
  const admin = adminClient()
  if (tutorialIds.length) await admin.from('tutorials').delete().in('id', tutorialIds)
  await admin.from('org_members').delete().eq('org_id', orgId)
  await admin.from('organizations').delete().eq('id', orgId)
}
