/** GET /api/printers/:id open_jobs: the accepted jobs a machine is carrying. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { call, ok } from './api.js'

const PICKUP = { pickup_line1: '1 Test St', pickup_suburb: 'Newtown', pickup_state: 'NSW', pickup_postcode: '2042' }
let family: TestUser
let owner: TestUser
let guideId: string
let printerId: string
let stlIds: string[]

const openJobs = async () => ((await (await call(family, 'GET', `/printers/${printerId}`)).json()) as { open_jobs: number }).open_jobs

beforeAll(async () => {
  ;[family, owner] = await Promise.all([createTestUser('contributor'), createTestUser('contributor')])
  const db = adminClient()
  guideId = (await db.from('tutorials').insert({ title: 'Open jobs guide', description: 'x', difficulty: 'easy', status: 'approved' }).select('id').single()).data!.id
  stlIds = (await db.from('stl_files').insert([{ tutorial_id: guideId, filename: 'part.stl', file_url: `${guideId}/part.stl` }]).select('id')).data!.map((f) => f.id)
  printerId = (
    await db.from('printers').insert({ owner_id: owner.id, name: 'Counted printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200, capacity: 3 }).select('id').single()
  ).data!.id
})
afterAll(async () => {
  const db = adminClient()
  await db.from('toy_transactions').delete().eq('tutorial_id', guideId)
  await db.from('printers').delete().eq('id', printerId)
  await db.from('tutorials').delete().eq('id', guideId)
  await Promise.all([family, owner].map((u) => deleteTestUser(u.id)))
})

describe('a printer card', () => {
  it('counts:printers.open_jobs rises when the printer accepts a job, not when it is only asked, and falls when the family withdraws', async () => {
    expect(await openJobs()).toBe(0)
    const job = await ok(family, 'POST', '/toy-transactions/print', { printer_ids: [printerId], tutorial_id: guideId, stl_file_ids: stlIds })
    expect(await openJobs()).toBe(0)

    await ok(owner, 'POST', `/toy-transactions/${job.id}/accept`, PICKUP)
    expect(await openJobs()).toBe(1)

    await ok(family, 'POST', `/toy-transactions/${job.id}/withdraw`)
    expect(await openJobs()).toBe(0)
  })
})
