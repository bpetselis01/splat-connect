import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

const BASE = 'http://localhost'

describe('GET /api/public/contributors/:id', () => {
  let maker: TestUser
  let hidden: TestUser
  let empty: TestUser

  beforeAll(async () => {
    const admin = adminClient()
    maker = await createTestUser()
    hidden = await createTestUser()
    empty = await createTestUser()

    // maker: one approved tutorial they are credited on.
    // tutorials has no owner_id; difficulty is NOT NULL; authorship is a
    // tutorial_contributors row with role 'primary'.
    const { data: tut } = await admin
      .from('tutorials')
      .insert({ title: 'Grip Aid', difficulty: 'easy', status: 'approved' })
      .select('id')
      .single()
    await admin
      .from('tutorial_contributors')
      .insert({ tutorial_id: tut!.id, profile_id: maker.id, role: 'primary' })

    // maker: one published toy (shared). condition is NOT NULL (1-10 check).
    await admin
      .from('toys')
      .insert({ name: 'Bear', status: 'published', owner_id: maker.id, quantity: 1, condition: 8 })

    // maker: one delivered toy — a completed handoff on a toy they gave away.
    // Inserted directly as admin rather than driving the full request/accept/
    // confirm flow, since only the resulting completed row matters here.
    const { data: deliveredToy } = await admin
      .from('toys')
      .insert({ name: 'Truck', status: 'draft', owner_id: maker.id, quantity: 1, condition: 5 })
      .select('id')
      .single()
    await admin.from('toy_transactions').insert({
      toy_id: deliveredToy!.id,
      type: 'donation',
      status: 'completed',
      requester_id: empty.id,
      owner_id: maker.id,
    })

    // hidden: opts out but has a published toy (would otherwise be eligible).
    await admin.from('profiles').update({ public_showcase: false }).eq('id', hidden.id)
    await admin
      .from('toys')
      .insert({ name: 'Ghost', status: 'published', owner_id: hidden.id, quantity: 1, condition: 8 })

    // empty: no tutorials, toys, or handoffs — zero public contributions.
  })

  afterAll(async () => {
    await deleteTestUser(maker.id)
    await deleteTestUser(hidden.id)
    await deleteTestUser(empty.id)
  })

  it('404s for opted-out and zero-contribution people, 200 for eligible', async () => {
    const ok = await app.request(`${BASE}/api/public/contributors/${maker.id}`)
    expect(ok.status).toBe(200)
    const body = (await ok.json()) as any
    expect(body.id).toBe(maker.id)
    expect(body.tutorials.length).toBeGreaterThanOrEqual(1)
    expect(body.toysShared.length).toBeGreaterThanOrEqual(1)
    expect(body.toysDelivered.length).toBeGreaterThanOrEqual(1)

    const gone = await app.request(`${BASE}/api/public/contributors/${hidden.id}`)
    expect(gone.status).toBe(404)

    const zero = await app.request(`${BASE}/api/public/contributors/${empty.id}`)
    expect(zero.status).toBe(404)

    const missing = await app.request(
      `${BASE}/api/public/contributors/00000000-0000-0000-0000-000000000000`
    )
    expect(missing.status).toBe(404)
  })
})
