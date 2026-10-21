/**
 * The admin queues with more jobs, guides and machines than fit in one
 * PostgREST URL (~300 uuids). The guide-title, printer-name and owner-name
 * lookups used to 414 and the rows past the first chunk came back unnamed.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { adminClient, createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

const COUNT = 350
const tag = `Admin Many ${Date.now()}`
let staff: TestUser
let family: TestUser
let orgIds: string[] = []
let guideIds: string[] = []
let printerIds: string[] = []
const last = COUNT - 1

const get = (path: string) => app.request(`/api/admin/${path}`, { headers: { Authorization: `Bearer ${staff.token}` } })
const slices = <T>(items: T[]) => Array.from({ length: Math.ceil(items.length / 100) }, (_, i) => items.slice(i * 100, i * 100 + 100))

beforeAll(async () => {
  ;[staff, family] = await Promise.all([createTestUser('admin'), createTestUser('contributor')])
  const sb = adminClient()
  const orgs = await sb
    .from('organizations')
    .insert(Array.from({ length: COUNT }, (_, i) => ({ name: `${tag} ${i}`, status: 'active', suburb: 'Crows Nest', state: 'NSW' })))
    .select('id')
  if (orgs.error) throw orgs.error
  orgIds = orgs.data.map((o) => o.id)
  const guides = await sb
    .from('tutorials')
    .insert(Array.from({ length: COUNT }, (_, i) => ({ title: `${tag} guide ${i}`, description: 'A guide', difficulty: 'easy', status: 'approved' })))
    .select('id')
  if (guides.error) throw guides.error
  guideIds = guides.data.map((g) => g.id)
  const printers = await sb
    .from('printers')
    .insert(orgIds.map((id, i) => ({ owner_org_id: id, name: `${tag} machine ${i}`, materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 })))
    .select('id')
  if (printers.error) throw printers.error
  printerIds = printers.data.map((p) => p.id)
  const jobs = await sb.from('toy_transactions').insert([
    ...guideIds.map((tutorial_id, i) => ({
      type: 'print', status: 'requested', tutorial_id, printer_id: printerIds[i], requester_id: family.id,
      owner_id: null, owner_org_id: orgIds[i], print_group_id: crypto.randomUUID(),
    })),
    ...guideIds.map((tutorial_id) => ({ type: 'build', status: 'requested', tutorial_id, requester_id: family.id, build_brief: 'For Leo' })),
  ])
  if (jobs.error) throw jobs.error
  const prints = await sb
    .from('printer_test_prints')
    .insert(printerIds.map((id) => ({ printer_id: id, photo_path: `${id}/${crypto.randomUUID()}.png` })))
  if (prints.error) throw prints.error
})

afterAll(async () => {
  const sb = adminClient()
  for (const part of slices(guideIds)) await sb.from('toy_transactions').delete().in('tutorial_id', part)
  for (const part of slices(printerIds)) await sb.from('printers').delete().in('id', part)
  for (const part of slices(guideIds)) await sb.from('tutorials').delete().in('id', part)
  for (const part of slices(orgIds)) await sb.from('organizations').delete().in('id', part)
  await Promise.all([staff, family].map((u) => deleteTestUser(u.id)))
})

describe('more than 300 rows in an admin queue', () => {
  it('names the guide and printer on every print job', async () => {
    const res = await get('print-jobs')
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ tutorial_id: string; tutorial_title: string | null; printer_name: string | null }>
    const row = rows.find((r) => r.tutorial_id === guideIds[last])!
    expect(row.tutorial_title).toBe(`${tag} guide ${last}`)
    expect(row.printer_name).toBe(`${tag} machine ${last}`)
  })

  it('names the guide on every build request', async () => {
    const res = await get('build-requests')
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ tutorial_id: string; tutorial_title: string | null }>
    expect(rows.find((r) => r.tutorial_id === guideIds[last])!.tutorial_title).toBe(`${tag} guide ${last}`)
  })

  it('names the machine and its owner on every test print', async () => {
    const res = await get('test-prints')
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ printer_id: string; printer_name: string | null; owner_name: string | null }>
    const row = rows.find((r) => r.printer_id === printerIds[last])!
    expect(row.printer_name).toBe(`${tag} machine ${last}`)
    expect(row.owner_name).toBe(`${tag} ${last}`)
  })
})
