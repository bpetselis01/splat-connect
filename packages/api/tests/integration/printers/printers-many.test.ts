/**
 * The printer list with more machines than fit in one PostgREST URL (~300
 * uuids). The open-job and owner-name lookups used to 414 and read as empty,
 * so every machine past the first chunk showed no owner and no open jobs.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { adminClient, createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

const COUNT = 350
const tag = `Printer Org ${Date.now()}`
let viewer: TestUser
let tutorialId: string
let orgIds: string[] = []
let printerIds: string[] = []

beforeAll(async () => {
  viewer = await createTestUser('contributor')
  const admin = adminClient()
  const { data: orgs, error: orgErr } = await admin
    .from('organizations')
    .insert(Array.from({ length: COUNT }, (_, i) => ({ name: `${tag} ${i}`, status: 'active', suburb: 'Crows Nest', state: 'NSW' })))
    .select('id, name')
  if (orgErr) throw orgErr
  orgIds = orgs!.map((o) => o.id)
  const { data: printers, error: pErr } = await admin
    .from('printers')
    .insert(orgs!.map((o) => ({ owner_org_id: o.id, name: `Machine ${o.name}`, materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200, suburb: 'Crows Nest', state: 'NSW', capacity: 1 })))
    .select('id')
  if (pErr) throw pErr
  printerIds = printers!.map((p) => p.id)
  const { data: guide, error: gErr } = await admin
    .from('tutorials')
    .insert({ title: `${tag} guide`, description: 'A guide', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  if (gErr) throw gErr
  tutorialId = guide!.id
  const { error: txErr } = await admin.from('toy_transactions').insert({
    type: 'print', status: 'accepted', tutorial_id: tutorialId, printer_id: printerIds[COUNT - 1],
    requester_id: viewer.id, owner_id: null, owner_org_id: orgIds[COUNT - 1], print_group_id: crypto.randomUUID(),
  })
  if (txErr) throw txErr
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await admin.from('tutorials').delete().eq('id', tutorialId)
  for (let i = 0; i < orgIds.length; i += 100) {
    await admin.from('printers').delete().in('owner_org_id', orgIds.slice(i, i + 100))
    await admin.from('organizations').delete().in('id', orgIds.slice(i, i + 100))
  }
  await deleteTestUser(viewer.id)
})

describe('more than 300 printers', () => {
  it('names the owner and counts the open jobs of the last one', async () => {
    const res = await app.request('/api/printers', { headers: { Authorization: `Bearer ${viewer.token}` } })
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ id: string; org_name: string | null; open_jobs: number }>
    const last = rows.find((r) => r.id === printerIds[COUNT - 1])!
    expect(last.org_name).toBe(`${tag} ${COUNT - 1}`)
    expect(last.open_jobs).toBe(1)
  })
})
