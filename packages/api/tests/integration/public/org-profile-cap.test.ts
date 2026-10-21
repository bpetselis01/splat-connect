// journeys: (none — route coverage; PostgREST 1000-row cap, no journey row)
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { adminClient, createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'
import { createOrg } from '../../helpers/orgs.js'

let leader: TestUser
let family: TestUser
let orgId: string
let tutorialId: string
let printerId: string

beforeAll(async () => {
  const admin = adminClient()
  leader = await createTestUser('contributor')
  family = await createTestUser('contributor')
  orgId = await createOrg({ createdBy: leader.id, status: 'active' })
  tutorialId = (await admin.from('tutorials').insert({ title: 'Cap fixture', description: 'x', difficulty: 'easy', status: 'approved' }).select('id').single()).data!.id as string
  printerId = (await admin.from('printers').insert({ owner_org_id: orgId, name: 'Cap printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 }).select('id').single()).data!.id as string
  const job = () => ({
    type: 'print', status: 'completed', tutorial_id: tutorialId, printer_id: printerId, requester_id: family.id,
    owner_org_id: orgId, print_group_id: crypto.randomUUID(),
  })
  const rows = Array.from({ length: 1001 }, job)
  for (let i = 0; i < rows.length; i += 500) {
    const { error } = await admin.from('toy_transactions').insert(rows.slice(i, i + 500))
    if (error) throw new Error(`seed failed: ${error.message}`)
  }
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await admin.from('printers').delete().eq('id', printerId)
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await admin.from('organizations').delete().eq('id', orgId)
  await Promise.all([leader, family].map((u) => deleteTestUser(u.id)))
})

describe('GET /api/public/organizations/:id', () => {
  it('counts every completed handoff past the 1000-row cap', async () => {
    const res = await app.request(`/api/public/organizations/${orgId}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { counts: { partsPrinted: number; familiesHelped: number } }
    expect(body.counts.partsPrinted).toBe(1001)
    expect(body.counts.familiesHelped).toBe(1)
  })
})
