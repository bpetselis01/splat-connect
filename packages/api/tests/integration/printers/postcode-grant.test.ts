/**
 * 099. A printer's postcode is the owner's, and only km built from it leaves
 * the API. The table is column-granted (028's profiles pattern), so the anon
 * and user keys cannot select it — and every reader of printers must still work.
 */
// journeys: R01 Z03
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

const url = process.env.SUPABASE_URL ?? 'http://localhost:54321'
const anonKey = process.env.SUPABASE_ANON_KEY ?? ''

let family: TestUser
let owner: TestUser
let tutorialId: string
let printerId: string
let jobId: string

const as = (u: TestUser) => ({ headers: { Authorization: `Bearer ${u.token}` } })

beforeAll(async () => {
  ;[family, owner] = await Promise.all([createTestUser('contributor'), createTestUser('contributor')])
  const admin = adminClient()
  const { data: t } = await admin
    .from('tutorials')
    .insert({ title: 'Postcode grant fixture', description: 'x', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = t!.id
  const { data: p } = await admin
    .from('printers')
    .insert({ owner_id: owner.id, name: 'Grant printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200, postcode: '2042' })
    .select('id')
    .single()
  printerId = p!.id
  const { data: job } = await admin
    .from('toy_transactions')
    .insert({ type: 'print', status: 'requested', tutorial_id: tutorialId, printer_id: printerId, requester_id: family.id, owner_id: owner.id, print_group_id: crypto.randomUUID() })
    .select('id')
    .single()
  jobId = job!.id
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await admin.from('printers').delete().eq('id', printerId)
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([family, owner].map((u) => deleteTestUser(u.id)))
})

describe('printers.postcode is not readable through PostgREST', () => {
  it('refuses the anon key', async () => {
    const anon = createClient(url, anonKey)
    expect((await anon.from('printers').select('postcode').eq('id', printerId)).error).not.toBeNull()
    expect((await anon.from('printers').select('id, name').eq('id', printerId)).data).toEqual([{ id: printerId, name: 'Grant printer' }])
  })
  it('refuses a signed-in key, the owner’s included', async () => {
    const user = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${owner.token}` } } })
    expect((await user.from('printers').select('postcode').eq('id', printerId)).error).not.toBeNull()
  })
})

describe('the readers of printers still read', () => {
  it('a print job names its printer (the embed fails silently if it cannot)', async () => {
    const res = await app.request(`/api/toy-transactions/${jobId}`, as(family))
    expect(res.status).toBe(200)
    expect(((await res.json()) as { printer: { id: string; name: string } | null }).printer).toMatchObject({ id: printerId, name: 'Grant printer' })
  })
  it('the list, the owner’s list and one printer still carry stats and verified', async () => {
    const list = (await (await app.request('/api/printers', as(family))).json()) as Array<Record<string, unknown>>
    expect(list.find((r) => r.id === printerId)).toMatchObject({ verified: false, printer_stats: expect.any(Object) })
    const mine = (await (await app.request('/api/printers/mine', as(owner))).json()) as Array<Record<string, unknown>>
    expect(mine.map((r) => r.id)).toContain(printerId)
    const one = (await (await app.request(`/api/printers/${printerId}`, as(family))).json()) as Record<string, unknown>
    expect(one).toMatchObject({ id: printerId, verified: false })
  })
})
