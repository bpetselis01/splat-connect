/**
 * 113: what a recycler takes, on the organisation, public by design. Limits
 * twice — a sentence from the API and a CHECK — and the booking honours them.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { DECLARATION_VERSION } from '@splat-connect/types'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader } from '../../helpers/orgs.js'

let leader: TestUser
let family: TestUser
let orgId: string

const json = (token: string, method: string, body?: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})
const patch = (body: unknown) => app.request(`/api/organizations/${orgId}/profile`, json(leader.token, 'PATCH', body))
const book = (grams: number) =>
  app.request(
    `/api/organizations/${orgId}/recycling`,
    json(family.token, 'POST', { material: 'PLA', estimated_grams: grams, condition_declared: true, declaration_version: DECLARATION_VERSION })
  )
const DETAILS = {
  recycling_machines: ['Shredder', 'Extruder'],
  recycling_forms: ['Failed prints', 'Offcuts'],
  recycling_min_kg: 3,
  recycling_max_kg: 8,
  recycling_turnaround: 'About 3 weeks',
  recycling_gives: 'either',
  recycling_hours: 'Tue and Thu, 9am–4pm',
  recycling_door: 'Loading door on Corella Lane — ring the bell',
}

beforeAll(async () => {
  ;[leader, family] = await Promise.all([createTestUser('contributor'), createTestUser('contributor')])
  orgId = await createOrg({ createdBy: leader.id, name: `Northside ${Date.now()}` })
  await addLeader(orgId, leader.id)
  await adminClient().from('organizations').update({ recycling_materials: ['PLA'] }).eq('id', orgId)
})

afterAll(async () => {
  await adminClient().from('recycling_dropoffs').delete().eq('org_id', orgId)
  await adminClient().from('organizations').delete().eq('id', orgId)
  await Promise.all([deleteTestUser(leader.id), deleteTestUser(family.id)])
})

describe('113 recycling details', () => {
  it('lets a leader publish them, and anyone read them', async () => {
    const res = await patch(DETAILS)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject(DETAILS)

    const anon = createClient(process.env.SUPABASE_URL ?? 'http://localhost:54321', process.env.SUPABASE_ANON_KEY ?? '')
    const { data, error } = await anon
      .from('organizations')
      .select('recycling_machines, recycling_forms, recycling_min_kg, recycling_max_kg, recycling_turnaround, recycling_gives, recycling_hours, recycling_door')
      .eq('id', orgId)
      .single()
    expect(error).toBeNull()
    expect(data).toMatchObject(DETAILS)

    const pub = (await (await app.request(`/api/public/organizations/${orgId}`)).json()) as Record<string, unknown>
    expect(pub).toMatchObject(DETAILS)
    const list = (await (await app.request('/api/public/organizations')).json()) as Array<Record<string, unknown>>
    expect(list.find((o) => o.id === orgId)).toMatchObject({ recycling_max_kg: 8, recycling_gives: 'either' })
  })

  it.each([
    [{ recycling_machines: ['Kiln'] }, 'recycling_machines must come from the list'],
    [{ recycling_forms: ['Tyres'] }, 'recycling_forms must come from the list'],
    [{ recycling_min_kg: 1.5 }, 'The platform floor is 2 kg. You can ask for more, never less.'],
    [{ recycling_max_kg: 2.25 }, 'Per drop is between 2 and 1000 kg, to one decimal place.'],
    [{ recycling_max_kg: 2.5 }, 'The maximum per drop cannot be under the minimum.'],
    [{ recycling_gives: 'cash' }, 'recycling_gives must be credit, spool or either'],
    [{ recycling_door: 'x'.repeat(121) }, 'recycling_door is longer than 120 characters'],
  ])('refuses %j', async (body, message) => {
    const res = await patch(body)
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe(message)
  })

  it('backs the max-over-min rule with a CHECK', async () => {
    const { error } = await adminClient().from('organizations').update({ recycling_max_kg: 2.5 }).eq('id', orgId)
    expect(error?.code).toBe('23514')
  })

  it('refuses a booking over the maximum or under the organisation’s minimum', async () => {
    const over = await book(9000)
    expect(over.status).toBe(400)
    expect(((await over.json()) as { error: string }).error).toMatch(/takes at most 8 kg at once\.$/)
    const under = await book(2500)
    expect(under.status).toBe(400)
    expect(((await under.json()) as { error: string }).error).toMatch(/takes at least 3 kg at once\.$/)
    expect((await book(5000)).status).toBe(201)
  })

  it('takes any weight from the floor up once the maximum is cleared', async () => {
    expect((await patch({ recycling_max_kg: null, recycling_min_kg: null })).status).toBe(200)
    expect((await book(40000)).status).toBe(201)
  })
})
