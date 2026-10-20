/**
 * 095. Jobs, median days, first-time fit and colours per printer, computed on
 * read over completed print jobs — never stored.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader } from '../../helpers/orgs.js'

let family: TestUser
let owner: TestUser
let leader: TestUser
let tutorialId: string
let printerId: string
let freshId: string
let orgPrinterId: string
let orgId: string

const ago = (days: number) => new Date(Date.now() - days * 864e5).toISOString()
const authed = (u: TestUser) => ({ headers: { Authorization: `Bearer ${u.token}` } })

beforeAll(async () => {
  family = await createTestUser('contributor')
  owner = await createTestUser('contributor')
  leader = await createTestUser('contributor')
  const admin = adminClient()
  const { data: t } = await admin
    .from('tutorials')
    .insert({ title: 'Stats fixture', description: 'x', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = t!.id
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  const machine = async (row: Record<string, unknown>) =>
    (
      await admin
        .from('printers')
        .insert({ name: 'Stats printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200, ...row })
        .select('id')
        .single()
    ).data!.id as string
  printerId = await machine({ owner_id: owner.id })
  freshId = await machine({ owner_id: owner.id })
  orgPrinterId = await machine({ owner_org_id: orgId })

  const done = (printer: string, side: Record<string, unknown>, created: number, a: number, b: number, extra: Record<string, unknown> = {}) => ({
    type: 'print', status: 'completed', tutorial_id: tutorialId, printer_id: printer, requester_id: family.id,
    print_group_id: crypto.randomUUID(), created_at: ago(created), owner_confirmed_at: ago(a), requester_confirmed_at: ago(b),
    ...side, ...extra,
  })
  const mine = { owner_id: owner.id }
  const { error } = await admin.from('toy_transactions').insert([
    // 4, 2 and 7 days to the later confirmation: median 4.
    done(printerId, mine, 10, 7, 6, { print_fit: 'fitted', print_fit_at: ago(5), print_colour: 'Blue' }),
    done(printerId, mine, 5, 3, 3, { print_fit: 'reprint', print_fit_at: ago(2), print_colour: 'Blue' }),
    done(printerId, mine, 9, 3, 2, { print_colour: 'Black' }),
    done(orgPrinterId, { owner_org_id: orgId }, 4, 2, 2),
    { type: 'print', status: 'requested', tutorial_id: tutorialId, printer_id: printerId, requester_id: family.id, owner_id: owner.id, print_group_id: crypto.randomUUID() },
  ], { defaultToNull: false }) // rows differ in keys; a missing created_at must take its default
  if (error) throw new Error(error.message)
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await admin.from('printers').delete().in('id', [printerId, freshId, orgPrinterId])
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await admin.from('organizations').delete().eq('id', orgId)
  await Promise.all([family, owner, leader].map((u) => deleteTestUser(u.id)))
})

describe('095 printer stats', () => {
  it('counts completed jobs, the median days, first-time fit and the colours most used', async () => {
    const res = await app.request(`/api/printers/${printerId}`, authed(family))
    expect(((await res.json()) as { printer_stats: unknown }).printer_stats).toEqual({
      jobs: 3, median_days: 4, fitted: 1, fit_answers: 2, colours: ['Blue', 'Black'],
    })
  })

  it('reads zero for a machine with no completed jobs', async () => {
    const res = await app.request('/api/printers', authed(family))
    const row = ((await res.json()) as Array<{ id: string; printer_stats: unknown }>).find((p) => p.id === freshId)
    expect(row!.printer_stats).toEqual({ jobs: 0, median_days: null, fitted: 0, fit_answers: 0, colours: [] })
  })

  it('gives an organisation its own turnaround', async () => {
    const res = await app.request(`/api/public/organizations/${orgId}`)
    expect(((await res.json()) as { print_stats: { jobs: number; median_days: number } }).print_stats).toMatchObject({
      jobs: 1, median_days: 2,
    })
  })

  it('keeps the raw aggregate off the anon key', async () => {
    const { createClient } = await import('@supabase/supabase-js')
    const anon = createClient(process.env.SUPABASE_URL ?? 'http://localhost:54321', process.env.SUPABASE_ANON_KEY ?? '')
    const { error } = await anon.rpc('print_job_stats', { p_printer_ids: [printerId] })
    expect(error).not.toBeNull()
  })
})
