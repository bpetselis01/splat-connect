// Run: packages/api/node_modules/.bin/vitest run --globals --root . supabase/e2e-seed.test.ts (local Supabase on :54321)
import { AGREEMENT_VERSIONS } from '@splat-connect/types'
import { adminClient, createAdmin, createEvent, createOrg, makeLeader } from './e2e-seed'

describe('supabase/e2e-seed', () => {
  it('createEvent with no questions writes no question rows', async () => {
    const admin = await createAdmin()
    const orgId = await createOrg()
    const eventId = await createEvent(orgId, admin.id)
    const { data } = await adminClient().from('org_event_questions').select('id').eq('event_id', eventId)
    expect(data).toEqual([])
  })

  it('createEvent writes its questions in order', async () => {
    const admin = await createAdmin()
    const orgId = await createOrg()
    const eventId = await createEvent(orgId, admin.id, {
      questions: [{ prompt: 'Dietary needs?', answer_type: 'short' }, { prompt: 'Pick one', answer_type: 'choice', options: ['a', 'b'] }],
    })
    const { data } = await adminClient().from('org_event_questions').select('position, prompt').eq('event_id', eventId).order('position')
    expect(data).toEqual([{ position: 1, prompt: 'Dietary needs?' }, { position: 2, prompt: 'Pick one' }])
  })

  it('makeLeader twice for one user and org leaves one leader row and one agreement', async () => {
    const user = await createAdmin()
    const orgId = await makeLeader(user.id)
    await makeLeader(user.id, undefined, orgId)
    const db = adminClient()
    const { data: leaders } = await db.from('org_leaders').select('id').eq('org_id', orgId).eq('user_id', user.id)
    const { data: terms } = await db.from('user_agreements').select('version').eq('user_id', user.id).eq('agreement_type', 'org_leader_terms')
    expect(leaders).toHaveLength(1)
    expect(terms).toEqual([{ version: AGREEMENT_VERSIONS.org_leader_terms }])
  })
})
