/** 096. Customization answers ride on the print request, per job. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let owner: TestUser
let tutorialId: string
let printerId: string
let stlId: string

const post = (body: Record<string, unknown>) =>
  app.request('/api/toy-transactions/print', {
    method: 'POST',
    headers: { Authorization: `Bearer ${family.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ printer_ids: [printerId], tutorial_id: tutorialId, stl_file_ids: [stlId], ...body }),
  })

beforeAll(async () => {
  family = await createTestUser('contributor')
  owner = await createTestUser('contributor')
  const admin = adminClient()
  const { data: t } = await admin
    .from('tutorials')
    .insert({ title: 'Fit notes fixture', description: 'x', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = t!.id
  const { data: f } = await admin
    .from('stl_files')
    .insert({ tutorial_id: tutorialId, filename: 'mount.stl', file_url: `${tutorialId}/mount.stl` })
    .select('id')
    .single()
  stlId = f!.id
  const { data: p } = await admin
    .from('printers')
    .insert({ owner_id: owner.id, name: 'Notes printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200, capacity: 3 })
    .select('id')
    .single()
  printerId = p!.id
})

afterAll(async () => {
  await adminClient().from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await adminClient().from('printers').delete().eq('id', printerId)
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(family.id)
  await deleteTestUser(owner.id)
})

describe('096 print_fit_notes', () => {
  it('stores the answers on the job', async () => {
    const res = await post({ fit_notes: { reach: '20–40 cm', mount: 'Floor stand' } })
    expect(res.status).toBe(201)
    const { id } = (await res.json()) as { id: string }
    const { data } = await adminClient().from('toy_transactions').select('print_fit_notes').eq('id', id).single()
    expect(data!.print_fit_notes).toEqual({ reach: '20–40 cm', mount: 'Floor stand' })
    await adminClient().from('toy_transactions').delete().eq('id', id)
  })

  it('refuses an answer the board does not offer', async () => {
    const res = await post({ fit_notes: { reach: '35 cm' } })
    expect(res.status).toBe(400)
  })

  it('is backed by the database: an unknown key is a CHECK violation', async () => {
    const { error } = await adminClient()
      .from('toy_transactions')
      .insert({
        type: 'print', status: 'requested', tutorial_id: tutorialId, printer_id: printerId, requester_id: family.id,
        owner_id: owner.id, print_group_id: crypto.randomUUID(), print_fit_notes: { shoe_size: '4' },
      })
    expect(error?.code).toBe('23514')
  })
})
