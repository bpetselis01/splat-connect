import { describe, it, expect, afterAll } from 'vitest'
import { adminClient } from '../../helpers/auth.js'

/**
 * enable_confirmations = true means signUp() never returns a session, so
 * there is no bearer token to POST /api/agreements with at signup time — the
 * client's own acceptance click can only ever be recorded once a session
 * exists, at first sign-in. This proves the DB records that acceptance from
 * signup metadata alone, with no session and no API call, so the onboarding
 * gate has nothing left to ask for by the time the user confirms their email.
 */
describe('signup-time contributor terms acceptance', () => {
  let userId: string | undefined

  afterAll(async () => {
    if (userId) {
      await adminClient().from('user_agreements').delete().eq('user_id', userId)
      await adminClient().auth.admin.deleteUser(userId)
    }
  })

  it('records a user_agreements row from signup metadata alone', async () => {
    const admin = adminClient()
    const email = `test-${crypto.randomUUID()}@splat-test.local`

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: 'Test1234!',
      email_confirm: true,
      user_metadata: { contributor_terms_version: 'v0-todo' },
    })
    expect(error).toBeNull()
    userId = data.user?.id
    expect(userId).toBeDefined()

    const { data: agreements, error: agreementsError } = await admin
      .from('user_agreements')
      .select('agreement_type, version')
      .eq('user_id', userId!)

    expect(agreementsError).toBeNull()
    expect(agreements).toEqual([{ agreement_type: 'contributor_terms', version: 'v0-todo' }])
  })

  it('records nothing when the metadata key is absent (existing accounts, admin-created users)', async () => {
    const admin = adminClient()
    const email = `test-${crypto.randomUUID()}@splat-test.local`

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: 'Test1234!',
      email_confirm: true,
    })
    expect(error).toBeNull()
    userId = data.user?.id

    const { data: agreements } = await admin
      .from('user_agreements')
      .select('id')
      .eq('user_id', userId!)

    expect(agreements).toEqual([])
  })
})
