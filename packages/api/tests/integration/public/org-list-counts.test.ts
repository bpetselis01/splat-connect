/**
 * 116: the organisations list carries what each one stands behind — backed
 * guides, shelf toys, a printer — as counts, never rows.
 */
// journeys: Q13
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, createProject, requestBacking, createOrgToy, cleanupOrg } from '../../helpers/orgs.js'

let leader: TestUser
let orgId: string
let printerOrgId: string
const tutorialIds: string[] = []

beforeAll(async () => {
  const admin = adminClient()
  leader = await createTestUser()
  orgId = await createOrg({ createdBy: leader.id, name: `Northside ${Date.now()}` })
  printerOrgId = await createOrg({ createdBy: leader.id, name: `Riverina ${Date.now()}` })
  await admin.from('organizations').update({ suburb: 'Newcastle', state: 'NSW', verified_at: new Date().toISOString() }).eq('id', orgId)
  for (const status of ['approved', 'approved', 'pending'] as const) {
    const id = await createProject({ authorId: leader.id, status })
    tutorialIds.push(id)
    await requestBacking({ tutorialId: id, orgId, status: 'accepted' })
  }
  await createOrgToy({ orgId })
  await createOrgToy({ orgId, status: 'draft' })
  await admin.from('printers').insert({ owner_org_id: printerOrgId, name: 'Prusa', bed_x: 250, bed_y: 210, bed_z: 210, accepting: true })
})

afterAll(async () => {
  await cleanupOrg(orgId, tutorialIds)
  await cleanupOrg(printerOrgId)
  await deleteTestUser(leader.id)
})

describe('GET /api/public/organizations — 116 counts', () => {
  it('the three definer functions exist', async () => {
    const { data, error } = await adminClient()
      .from('organizations')
      .select('org_backed_count, org_toy_count, org_has_printer')
      .eq('id', orgId)
      .single()
    expect(error).toBeNull()
    expect(data).toMatchObject({ org_backed_count: 2, org_toy_count: 1, org_has_printer: false })
  })

  it('serves place, badges and counts to a signed-out reader', async () => {
    const rows = (await (await app.request('/api/public/organizations')).json()) as Array<Record<string, unknown>>
    expect(rows.find((r) => r.id === orgId)).toMatchObject({
      suburb: 'Newcastle', state: 'NSW', backed_count: 2, toy_count: 1, has_printer: false,
    })
    expect(rows.find((r) => r.id === orgId)!.verified_at).toBeTruthy()
    expect(rows.find((r) => r.id === printerOrgId)).toMatchObject({ backed_count: 0, toy_count: 0, has_printer: true })
  })
})
