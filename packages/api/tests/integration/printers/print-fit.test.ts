/**
 * Did it fit? — the family who asked says so once the parts are collected.
 * "Needs a reprint" tells the printer, in the thread and the inbox.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let owner: TestUser
let tutorialId: string
let printerId: string

const fit = (u: TestUser, id: string, body: unknown) =>
  app.request(`/api/toy-transactions/${id}/print-fit`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const job = async (status: 'requested' | 'completed') =>
  (
    await adminClient()
      .from('toy_transactions')
      .insert({
        type: 'print', status, tutorial_id: tutorialId, printer_id: printerId, requester_id: family.id,
        owner_id: owner.id, print_group_id: crypto.randomUUID(),
      })
      .select('id')
      .single()
  ).data!.id as string

beforeAll(async () => {
  family = await createTestUser('contributor')
  owner = await createTestUser('contributor')
  const admin = adminClient()
  const { data: t } = await admin
    .from('tutorials')
    .insert({ title: 'Fit fixture', description: 'x', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = t!.id
  const { data: p } = await admin
    .from('printers')
    .insert({ owner_id: owner.id, name: 'Fit printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 })
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

describe('094 print fit', () => {
  it('has the columns', async () => {
    const { error } = await adminClient().from('toy_transactions').select('print_fit, print_fit_at').limit(1)
    expect(error).toBeNull()
  })

  it('refuses anything but fitted or reprint', async () => {
    expect((await fit(family, await job('completed'), { fit: 'maybe' })).status).toBe(400)
  })

  it('is the family’s to say, not the printer’s', async () => {
    expect((await fit(owner, await job('completed'), { fit: 'fitted' })).status).toBe(403)
  })

  it('waits until the parts are collected', async () => {
    expect((await fit(family, await job('requested'), { fit: 'fitted' })).status).toBe(409)
  })

  it('records a reprint once, and tells the printer', async () => {
    const id = await job('completed')
    const res = await fit(family, id, { fit: 'reprint' })
    expect(res.status).toBe(200)
    expect(((await res.json()) as { print_fit: string }).print_fit).toBe('reprint')
    const admin = adminClient()
    const { data: told } = await admin.from('notifications').select('type').eq('recipient_id', owner.id).eq('toy_transaction_id', id)
    expect(told!.map((n) => n.type)).toContain('toy_message')
    const { data: said } = await admin.from('toy_transaction_messages').select('body').eq('transaction_id', id)
    expect(said!.map((m) => m.body)).toContain('Needs a reprint.')
    expect((await fit(family, id, { fit: 'fitted' })).status).toBe(409)
  })
})
