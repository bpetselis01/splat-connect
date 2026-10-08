/**
 * A quantity per part (058's print_job_files.quantity, 1–20). `files` carries
 * it; the old `stl_file_ids` still means one of each.
 */
// journeys: R03
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let owner: TestUser
let tutorialId: string
let printerId: string
let a: string
let b: string

const post = (body: unknown) =>
  app.request('/api/toy-transactions/print', {
    method: 'POST',
    headers: { Authorization: `Bearer ${family.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const clear = () => adminClient().from('toy_transactions').delete().eq('tutorial_id', tutorialId)

beforeAll(async () => {
  family = await createTestUser('contributor')
  owner = await createTestUser('contributor')
  const admin = adminClient()
  const { data: t } = await admin
    .from('tutorials')
    .insert({ title: 'Quantity fixture', description: 'x', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = t!.id
  const { data: files } = await admin
    .from('stl_files')
    .insert([
      { tutorial_id: tutorialId, filename: 'a.stl', file_url: `${tutorialId}/a.stl` },
      { tutorial_id: tutorialId, filename: 'b.stl', file_url: `${tutorialId}/b.stl` },
    ])
    .select('id, filename')
  a = files!.find((f) => f.filename === 'a.stl')!.id
  b = files!.find((f) => f.filename === 'b.stl')!.id
  const { data: p } = await admin
    .from('printers')
    .insert({ owner_id: owner.id, name: 'Qty printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200, capacity: 3 })
    .select('id')
    .single()
  printerId = p!.id
})

afterAll(async () => {
  await clear()
  await adminClient().from('printers').delete().eq('id', printerId)
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(family.id)
  await deleteTestUser(owner.id)
})

describe('POST /print quantities', () => {
  it('stores a quantity per part', async () => {
    const res = await post({
      printer_ids: [printerId],
      tutorial_id: tutorialId,
      files: [{ stl_file_id: a, quantity: 3 }, { stl_file_id: b }],
    })
    expect(res.status).toBe(201)
    const { id } = (await res.json()) as { id: string }
    const { data } = await adminClient().from('print_job_files').select('stl_file_id, quantity').eq('transaction_id', id)
    expect(Object.fromEntries(data!.map((r) => [r.stl_file_id, r.quantity]))).toEqual({ [a]: 3, [b]: 1 })
    await clear()
  })

  it('still takes stl_file_ids as one of each', async () => {
    const res = await post({ printer_ids: [printerId], tutorial_id: tutorialId, stl_file_ids: [a] })
    expect(res.status).toBe(201)
    const { id } = (await res.json()) as { id: string }
    const { data } = await adminClient().from('print_job_files').select('quantity').eq('transaction_id', id)
    expect(data).toEqual([{ quantity: 1 }])
    await clear()
  })

  it.each([
    [[{ stl_file_id: 'x', quantity: 0 }], 'Ask for between 1 and 20 of each part.'],
    [[{ stl_file_id: 'x', quantity: 21 }], 'Ask for between 1 and 20 of each part.'],
    [[{ stl_file_id: 'x', quantity: 1.5 }], 'Ask for between 1 and 20 of each part.'],
  ])('refuses %j', async (files, message) => {
    const res = await post({ printer_ids: [printerId], tutorial_id: tutorialId, files })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe(message)
  })

  it('refuses a part named twice', async () => {
    const res = await post({
      printer_ids: [printerId],
      tutorial_id: tutorialId,
      files: [{ stl_file_id: a }, { stl_file_id: a, quantity: 2 }],
    })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe('Name each part once.')
  })
})
