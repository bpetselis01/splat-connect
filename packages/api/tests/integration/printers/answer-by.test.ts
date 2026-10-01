/**
 * Answer by: a print request waits seven days. After that accept refuses it
 * and the badge stops counting it — computed on read, no scheduled job.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let owner: TestUser
let tutorialId: string
let printerId: string
let staleId: string
let stlId: string

const as = (u: TestUser, method = 'GET', body?: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})
const pickup = { pickup_line1: '1 Test St', pickup_suburb: 'Newtown', pickup_state: 'NSW', pickup_postcode: '2042' }

beforeAll(async () => {
  family = await createTestUser('contributor')
  owner = await createTestUser('contributor')
  const admin = adminClient()
  const { data: t } = await admin
    .from('tutorials')
    .insert({ title: 'Answer-by fixture', description: 'x', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = t!.id
  const { data: p } = await admin
    .from('printers')
    .insert({ owner_id: owner.id, name: 'Slow printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 })
    .select('id')
    .single()
  printerId = p!.id
  const { data: stale } = await admin
    .from('toy_transactions')
    .insert({
      type: 'print', status: 'requested', tutorial_id: tutorialId, printer_id: printerId, requester_id: family.id,
      owner_id: owner.id, print_group_id: crypto.randomUUID(), created_at: new Date(Date.now() - 8 * 864e5).toISOString(),
    })
    .select('id')
    .single()
  staleId = stale!.id
  const { data: f } = await admin
    .from('stl_files')
    .insert({ tutorial_id: tutorialId, filename: 'part.stl', file_url: `${tutorialId}/part.stl` })
    .select('id')
    .single()
  stlId = f!.id
})

afterAll(async () => {
  await adminClient().from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await adminClient().from('stl_files').delete().eq('tutorial_id', tutorialId)
  await adminClient().from('printers').delete().eq('id', printerId)
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(family.id)
  await deleteTestUser(owner.id)
})

describe('an unanswered print request after seven days', () => {
  it('cannot be accepted, and says when it expired', async () => {
    const res = await app.request(`/api/toy-transactions/${staleId}/accept`, as(owner, 'POST', pickup))
    expect(res.status).toBe(409)
    expect(((await res.json()) as { error: string }).error).toMatch(/^This request expired on \d{1,2} \w{3}; ask again\.$/)
  })

  it('no longer counts on the printer’s badge', async () => {
    const res = await app.request('/api/toy-transactions/action-count', as(owner))
    expect(await res.json()).toEqual({ count: 0 })
  })
})

describe('asking the same printer again', () => {
  const ask = () =>
    app.request(
      '/api/toy-transactions/print',
      as(family, 'POST', { printer_ids: [printerId], tutorial_id: tutorialId, stl_file_ids: [stlId] })
    )

  it('is not blocked by an expired request, but a fresh one still blocks', async () => {
    expect((await ask()).status).toBe(201)
    expect((await ask()).status).toBe(409)
  })
})
