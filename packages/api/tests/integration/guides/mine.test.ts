import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let family: TestUser
let guide: string
let printed: string
let printerId: string

const mine = async () =>
  (await (await app.request('/api/tutorials/mine', { headers: { Authorization: `Bearer ${author.token}` } })).json()) as Array<
    Record<string, unknown> & { id: string }
  >

beforeAll(async () => {
  author = await createTestUser('contributor')
  family = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'draft', title: 'Mine Fixture' })
  printed = await createProject({ authorId: author.id, status: 'approved', title: 'Printed Fixture' })
  const admin = adminClient()
  await admin.from('parts').insert({ tutorial_id: guide, name: 'Switch', quantity: 1, is_optional: false, buy_links: [] })
  printerId = (
    await admin
      .from('printers')
      .insert({ owner_id: family.id, name: 'Mine printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 })
      .select('id')
      .single()
  ).data!.id as string
  const job = (print_fit: 'fitted' | 'reprint' | null) => ({
    type: 'print', status: 'completed', tutorial_id: printed, printer_id: printerId, requester_id: author.id,
    owner_id: family.id, print_group_id: crypto.randomUUID(),
    print_fit, print_fit_at: print_fit ? new Date().toISOString() : null,
  })
  const { error } = await admin.from('toy_transactions').insert([job('fitted'), job('fitted'), job('reprint'), job(null)])
  if (error) throw error
})
afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().eq('tutorial_id', printed)
  await admin.from('printers').delete().eq('id', printerId)
  await admin.from('tutorials').delete().in('id', [guide, printed])
  await Promise.all([author, family].map((u) => deleteTestUser(u.id)))
})

describe('GET /api/tutorials/mine', () => {
  it('T01 WT36 carries what the row needs to count its sections', async () => {
    const res = await app.request('/api/tutorials/mine', { headers: { Authorization: `Bearer ${author.token}` } })
    const row = ((await res.json()) as Record<string, unknown[]>[]).find((r) => (r as unknown as { id: string }).id === guide)!
    expect(row.parts).toHaveLength(1)
    expect(row.tools).toEqual([])
    expect(row.stl_files).toEqual([])
    expect(row.steps).toEqual([])
  })

  it('counts the fit answers on each guide’s prints', async () => {
    const rows = await mine()
    expect(rows.find((r) => r.id === printed)!.print_fit_stats).toEqual({ fitted: 2, fit_answers: 3 })
    expect(rows.find((r) => r.id === guide)!.print_fit_stats).toEqual({ fitted: 0, fit_answers: 0 })
  })

  it('counts every fit answer on a guide past the 1000-row cap', async () => {
    const admin = adminClient()
    const popular = await createProject({ authorId: author.id, status: 'approved', title: 'Popular Fixture' })
    const job = () => ({
      type: 'print', status: 'completed', tutorial_id: popular, printer_id: printerId, requester_id: author.id,
      owner_id: family.id, print_group_id: crypto.randomUUID(), print_fit: 'fitted', print_fit_at: new Date().toISOString(),
    })
    try {
      const rows = Array.from({ length: 1001 }, job)
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await admin.from('toy_transactions').insert(rows.slice(i, i + 500))
        if (error) throw error
      }
      expect((await mine()).find((r) => r.id === popular)!.print_fit_stats).toEqual({ fitted: 1001, fit_answers: 1001 })
    } finally {
      await admin.from('toy_transactions').delete().eq('tutorial_id', popular)
      await admin.from('tutorials').delete().eq('id', popular)
    }
  })
})
