/**
 * What the mobile "Print for others" tabs read: the owner's machines and the
 * print jobs on them. Requests are status 'requested', Jobs are 'accepted'.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let owner: TestUser
let stranger: TestUser
let tutorialId: string
let printerId: string
let stlIds: string[] = []

const call = (u: TestUser, path: string, method = 'GET', body?: unknown) =>
  app.request(path, {
    method,
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
const jobsOn = async (u: TestUser) =>
  ((await (await call(u, '/api/toy-transactions')).json()) as Array<{ type: string; status: string; printer_id: string | null }>).filter(
    (t) => t.type === 'print' && t.printer_id === printerId
  )

beforeAll(async () => {
  ;[family, owner, stranger] = await Promise.all([1, 2, 3].map(() => createTestUser('contributor')))
  const admin = adminClient()
  const { data: t } = await admin.from('tutorials').insert({ title: 'Tabs print', description: 'x', difficulty: 'easy', status: 'approved' }).select('id').single()
  tutorialId = t!.id
  const { data: files } = await admin.from('stl_files').insert([{ tutorial_id: tutorialId, filename: 'part.stl', file_url: `${tutorialId}/part.stl` }]).select('id')
  stlIds = files!.map((f: { id: string }) => f.id)
  const { data: p } = await admin
    .from('printers')
    .insert({ name: 'Tabs printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200, capacity: 3, owner_id: owner.id })
    .select('id')
    .single()
  printerId = p!.id
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await admin.from('printers').delete().eq('id', printerId)
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([family, owner, stranger].map((u) => deleteTestUser(u.id)))
})

describe('offer tabs data', () => {
  it('R12 moves a job from the Requests tab to the Jobs tab on accept, for the owner only', async () => {
    const asked = await call(family, '/api/toy-transactions/print', 'POST', { printer_ids: [printerId], tutorial_id: tutorialId, stl_file_ids: stlIds })
    expect(asked.status).toBe(201)
    const { transactions } = (await asked.json()) as { transactions: Array<{ id: string }> }

    const mineBefore = (await (await call(owner, '/api/printers/mine')).json()) as Array<{ id: string; open_jobs: number }>
    expect(mineBefore.find((p) => p.id === printerId)!.open_jobs).toBe(0)
    expect((await jobsOn(owner)).map((j) => j.status)).toEqual(['requested'])
    expect(await jobsOn(stranger)).toEqual([])

    const pickup = { pickup_line1: '1 Test St', pickup_suburb: 'Newtown', pickup_state: 'NSW', pickup_postcode: '2042' }
    expect((await call(owner, `/api/toy-transactions/${transactions[0].id}/accept`, 'POST', pickup)).status).toBe(200)

    const mineAfter = (await (await call(owner, '/api/printers/mine')).json()) as Array<{ id: string; open_jobs: number }>
    expect(mineAfter.find((p) => p.id === printerId)!.open_jobs).toBe(1)
    expect((await jobsOn(owner)).map((j) => j.status)).toEqual(['accepted'])
    expect((await (await call(stranger, '/api/printers/mine')).json()) as unknown[]).toEqual([])
  })
})
