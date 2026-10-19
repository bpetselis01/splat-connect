/**
 * The inbox and the job page embed the guide's print settings (088) on every
 * print job. When the database lacked those columns the whole exchanges list
 * was a 500, so this pins the embed on both routes against the real schema.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let maker: TestUser
let guide: string
let printer: string
let job: string
const settings = { layer_height_mm: 0.2, infill_percent: 15, material: 'PETG', print_minutes: 95 }

beforeAll(async () => {
  family = await createTestUser('contributor')
  maker = await createTestUser('contributor')
  const db = adminClient()
  const g = await db.from('tutorials').insert({ title: 'Embed fixture', description: 'G', difficulty: 'easy', status: 'approved', ...settings }).select('id').single()
  if (g.error) throw g.error
  guide = g.data.id
  const p = await db.from('printers').insert({ owner_id: maker.id, name: 'Bench', bed_x: 220, bed_y: 220, bed_z: 250, materials: ['PETG'] }).select('id').single()
  if (p.error) throw p.error
  printer = p.data.id
  const t = await db
    .from('toy_transactions')
    .insert({ type: 'print', status: 'requested', tutorial_id: guide, printer_id: printer, requester_id: family.id, owner_id: maker.id })
    .select('id')
    .single()
  if (t.error) throw t.error
  job = t.data.id
})

afterAll(async () => {
  const db = adminClient()
  await db.from('toy_transactions').delete().eq('id', job)
  await db.from('printers').delete().eq('id', printer)
  await db.from('tutorials').delete().eq('id', guide)
  await deleteTestUser(family.id)
  await deleteTestUser(maker.id)
})

describe('print settings on a print job', () => {
  it('X01 the exchanges list carries the guide\'s four settings', async () => {
    const res = await app.request('/api/toy-transactions', { headers: { Authorization: `Bearer ${family.token}` } })
    expect(res.status).toBe(200)
    const rows = (await res.json()) as { id: string; tutorial: Record<string, unknown> }[]
    expect(rows.find((r) => r.id === job)!.tutorial).toMatchObject({ title: 'Embed fixture', ...settings })
  })

  it('R04 the job detail carries them too', async () => {
    const res = await app.request(`/api/toy-transactions/${job}`, { headers: { Authorization: `Bearer ${maker.token}` } })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { tutorial: Record<string, unknown> }).tutorial).toMatchObject(settings)
  })
})
