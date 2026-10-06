import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

// 129: a step's tip and minutes, "Required first" on a recommendation, and the
// guide's closing line all round-trip, and a bad value is a 400.
let author: TestUser
let guide: string
let other: string
const req = (path: string, method: string, body: unknown) =>
  app.request(`/api/tutorials/${guide}${path}`, {
    method,
    headers: { Authorization: `Bearer ${author.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeAll(async () => {
  author = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'draft', title: 'Board Extras Fixture' })
  other = await createProject({ authorId: author.id, status: 'approved', title: 'Board Extras Prerequisite' })
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().in('id', [guide, other])
  await deleteTestUser(author.id)
})

describe('129 guide board extras', () => {
  it('saves a step tip and minutes, and refuses minutes out of range', async () => {
    const ok = await req('/steps', 'PUT', { steps: [{ title: 'Solder', body: 'Solder both leads.', tip: '  Rest the iron in its stand.  ', minutes: 10 }] })
    expect(ok.status).toBe(200)
    const { data } = await adminClient().from('tutorial_steps').select('tip, minutes').eq('tutorial_id', guide).single()
    expect(data).toEqual({ tip: 'Rest the iron in its stand.', minutes: 10 })
    const bad = await req('/steps', 'PUT', { steps: [{ body: 'x', minutes: 0 }] })
    expect(bad.status).toBe(400)
  })

  it('marks a recommendation Required first', async () => {
    const res = await req('/recommendations', 'POST', { recommendations: [{ recommended_id: other, required: true }] })
    expect(res.status).toBe(201)
    const { data } = await adminClient().from('tutorial_recommendations').select('required').eq('tutorial_id', guide).single()
    expect(data).toEqual({ required: true })
  })

  it('saves the closing line and refuses one over 300 characters', async () => {
    const lock = async () => (await adminClient().from('tutorials').select('updated_at').eq('id', guide).single()).data!.updated_at
    expect((await req('', 'PATCH', { done_note: 'Plug it into the bubble machine.', updated_at: await lock() })).status).toBe(200)
    const bad = await req('', 'PATCH', { done_note: 'x'.repeat(301), updated_at: await lock() })
    expect(bad.status).toBe(400)
    expect(((await bad.json()) as { error: string }).error).toBe('The closing line is over 300 characters')
  })
})
