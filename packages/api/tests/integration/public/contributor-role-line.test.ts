/**
 * 124 — the showcase's role line: the occupation a contributor typed, and the
 * active organisation they lead.
 */
// journeys: Q13
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let maker: TestUser
let tutorialId: string
let orgId: string
let suspendedId: string

const patch = (body: unknown) =>
  app.request('/api/contributors/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${maker.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const showcase = async () =>
  (await (await app.request(`/api/public/contributors/${maker.id}`)).json()) as {
    occupation: string | null
    org: { id: string; name: string } | null
  }

beforeAll(async () => {
  const admin = adminClient()
  maker = await createTestUser()
  const { data: t } = await admin.from('tutorials').insert({ title: 'Drum', difficulty: 'easy', status: 'approved' }).select('id').single()
  tutorialId = t!.id
  await admin.from('tutorial_contributors').insert({ tutorial_id: tutorialId, profile_id: maker.id, role: 'primary' })
  const stamp = Date.now()
  suspendedId = (await admin.from('organizations').insert({ name: `Gone ${stamp}`, status: 'suspended' }).select('id').single()).data!.id
  orgId = (await admin.from('organizations').insert({ name: `Clinic ${stamp}`, status: 'active' }).select('id').single()).data!.id
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await admin.from('organizations').delete().in('id', [orgId, suspendedId])
  await deleteTestUser(maker.id)
})

describe('contributor role line', () => {
  it('is empty until the contributor says what they do', async () => {
    expect(await showcase()).toMatchObject({ occupation: null, org: null })
  })

  it('shows the occupation they save, trimmed, and refuses a long one', async () => {
    expect((await patch({ occupation: '  Occupational therapist ' })).status).toBe(200)
    expect((await showcase()).occupation).toBe('Occupational therapist')
    expect((await patch({ occupation: 'x'.repeat(61) })).status).toBe(400)
    expect((await patch({ occupation: 42 })).status).toBe(400)
    expect((await patch({ occupation: '' })).status).toBe(200)
    expect((await showcase()).occupation).toBeNull()
  })

  it('chips the active organisation they lead, never a suspended one', async () => {
    const admin = adminClient()
    await admin.from('org_leaders').insert({ org_id: suspendedId, user_id: maker.id })
    expect((await showcase()).org).toBeNull()
    await admin.from('org_leaders').insert({ org_id: orgId, user_id: maker.id })
    expect((await showcase()).org).toEqual({ id: orgId, name: expect.stringMatching(/^Clinic /) })
  })
})
