// journeys: (none — route coverage; no journey row names this route yet)
/**
 * GET /api/admin/print-jobs lists every print job, newest first, with the guide
 * and printer names; an accepted job with no ready_at that has not moved in 10
 * days is "stalled" and sorts to the top.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let admin: TestUser
let member: TestUser
let owner: TestUser
let family: TestUser
let guide: string
let printerId: string
const job: Record<string, string> = {}

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString()
const get = (token?: string) => app.request('/api/admin/print-jobs', token ? { headers: { Authorization: `Bearer ${token}` } } : {})

beforeAll(async () => {
  ;[admin, member, owner, family] = await Promise.all([createTestUser('admin'), createTestUser('contributor'), createTestUser('contributor'), createTestUser('contributor')])
  guide = await createProject({ authorId: owner.id, status: 'approved', title: 'Print Queue Guide' })
  const sb = adminClient()
  const { data: p, error: pe } = await sb.from('printers').insert({ owner_id: owner.id, name: 'Queue printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 }).select('id').single()
  if (pe) throw new Error(pe.message)
  printerId = p.id
  const make = async (name: string, over: Record<string, unknown>) => {
    const { data, error } = await sb
      .from('toy_transactions')
      .insert({ type: 'print', tutorial_id: guide, printer_id: printerId, requester_id: family.id, owner_id: owner.id, print_group_id: crypto.randomUUID(), ...over })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    job[name] = data.id
  }
  await make('older', { status: 'requested', created_at: daysAgo(5) })
  await make('newer', { status: 'requested', created_at: daysAgo(1) })
  await make('stalled', { status: 'accepted', created_at: daysAgo(20), updated_at: daysAgo(12) })
  await make('moving', { status: 'accepted', created_at: daysAgo(15), updated_at: daysAgo(2) })
  await make('ready', { status: 'accepted', created_at: daysAgo(25), updated_at: daysAgo(12), printing_started_at: daysAgo(13), ready_at: daysAgo(11), ready_photo_url: 'ready.jpg' })
})
afterAll(async () => {
  const sb = adminClient()
  await sb.from('toy_transactions').delete().eq('tutorial_id', guide)
  await sb.from('printers').delete().eq('id', printerId)
  await sb.from('tutorials').delete().eq('id', guide)
  for (const u of [admin, member, owner, family]) await deleteTestUser(u.id)
})

describe('admin print-job list', () => {
  it('is admin-only', async () => {
    expect((await get(member.token)).status).toBe(403)
    expect((await get()).status).toBe(401)
  })

  it('WM33 puts the stalled job first, then the rest newest first, with guide and printer names', async () => {
    const res = await get(admin.token)
    expect(res.status).toBe(200)
    const rows = ((await res.json()) as Array<Record<string, unknown> & { id: string; tutorial_id: string }>).filter((r) => r.tutorial_id === guide)
    expect(rows.map((r) => r.id)).toEqual([job.stalled, job.newer, job.older, job.moving, job.ready])
    expect(rows[0]).toMatchObject({ stalled: true, idle_days: 12, tutorial_title: 'Print Queue Guide', printer_name: 'Queue printer' })
    expect(rows.slice(1).map((r) => r.stalled)).toEqual([false, false, false, false])
  })
})
