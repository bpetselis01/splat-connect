import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

const BASE = 'http://localhost'

describe('GET /api/public/impact', () => {
  let maker: TestUser
  let hidden: TestUser

  beforeAll(async () => {
    const admin = adminClient()
    maker = await createTestUser()
    hidden = await createTestUser()
    // maker: one approved tutorial they are credited on.
    // Ruling A: tutorials has no owner_id; difficulty is NOT NULL; authorship is
    // a tutorial_contributors row with role 'primary' (check is primary|collaborator).
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
    // hidden: opts out but has a published toy
    await admin.from('profiles').update({ public_showcase: false }).eq('id', hidden.id)
    await admin
      .from('toys')
      .insert({ name: 'Ghost', status: 'published', owner_id: hidden.id, quantity: 1, condition: 8 })
  })

  afterAll(async () => {
    // deleteTestUser cascades to the seeded profile rows; toys/tutorials seeded
    // above cascade on owner/profile delete. If any orphan remains, delete it by
    // the captured id here.
    await deleteTestUser(maker.id)
    await deleteTestUser(hidden.id)
  })

  it('Q14 WH06 WS01 counts approved tutorials and shared toys, and excludes opted-out people', async () => {
    const res = await app.request(`${BASE}/api/public/impact`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    const makerCard = body.contributors.find((c: any) => c.id === maker.id)
    expect(makerCard).toBeTruthy()
    expect(makerCard.tutorials).toBeGreaterThanOrEqual(1)
    expect(makerCard.toysShared).toBeGreaterThanOrEqual(1)
    expect(body.contributors.some((c: any) => c.id === hidden.id)).toBe(false)
    expect(body.recent.some((r: any) => r.id === hidden.id)).toBe(false)
    expect(body.totals.tutorials).toBeGreaterThanOrEqual(1)
    // opt-out guarantee on the numeric total, not just the list
    expect(body.totals.contributors).toBe(body.contributors.length)
  })

  it('totals count every approved guide past the 1000-row cap', async () => {
    const { count } = await adminClient().from('tutorials').select('id', { count: 'exact', head: true }).eq('status', 'approved')
    const body = (await (await app.request(`${BASE}/api/public/impact`)).json()) as any
    expect(body.totals.tutorials).toBe(count)
  })
})
