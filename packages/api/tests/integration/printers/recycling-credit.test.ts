/**
 * 114: recycling credit spent on a print job. Grams, never money; spent only
 * at the organisation that issued it, and only when that organisation's
 * printer accepts — in the same database call as the accept, re-checking the
 * balance, once per job.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createUserClient } from '../../../src/supabase/client.js'
import { DECLARATION_VERSION } from '@splat-connect/types'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader } from '../../helpers/orgs.js'

let family: TestUser
let leadA: TestUser
let leadB: TestUser
let maker: TestUser
let orgA: string
let orgB: string
const printers: Record<string, string> = {}
const guides: string[] = []
const parts: string[] = []

const json = (token: string, method: string, body?: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})
const pickup = { pickup_line1: '1 Test St', pickup_suburb: 'Newtown', pickup_state: 'NSW', pickup_postcode: '2042' }
/** Guide n has one 100 g part. */
const ask = (n: number, printerIds: string[], extra: Record<string, unknown> = {}, quantity = 1) =>
  app.request(
    '/api/toy-transactions/print',
    json(family.token, 'POST', { printer_ids: printerIds, tutorial_id: guides[n], files: [{ stl_file_id: parts[n], quantity }], ...extra })
  )
const jobOn = async (n: number, printerId: string) =>
  (await adminClient().from('toy_transactions').select('id, print_credit_grams, status').eq('tutorial_id', guides[n]).eq('printer_id', printerId).single()).data!
const spends = async () =>
  (await adminClient().from('recycling_credit_spends').select('transaction_id, grams, org_id').eq('profile_id', family.id)).data!
const credit = async () =>
  (await (await app.request('/api/organizations/recycling/credit', json(family.token, 'GET'))).json()) as Array<{ org_id: string; grams: number; weighed_grams: number }>

beforeAll(async () => {
  ;[family, leadA, leadB, maker] = await Promise.all([1, 2, 3, 4].map(() => createTestUser('contributor')))
  const admin = adminClient()
  orgA = await createOrg({ createdBy: leadA.id, name: `Northside ${Date.now()}` })
  orgB = await createOrg({ createdBy: leadB.id, name: `Riverina ${Date.now()}` })
  await addLeader(orgA, leadA.id)
  await addLeader(orgB, leadB.id)
  await admin.from('organizations').update({ pickup_line1: '1 Org St', pickup_suburb: 'Newtown', pickup_state: 'NSW', pickup_postcode: '2042' }).in('id', [orgA, orgB])
  for (let n = 0; n < 6; n++) {
    const { data: t } = await admin.from('tutorials').insert({ title: `Credit fixture ${n}`, description: 'x', difficulty: 'easy', status: 'approved' }).select('id').single()
    guides.push(t!.id)
    const { data: f } = await admin.from('stl_files').insert({ tutorial_id: t!.id, filename: 'mount.stl', file_url: `${t!.id}/mount.stl`, filament_grams: 100 }).select('id').single()
    parts.push(f!.id)
  }
  const machine = async (row: Record<string, unknown>) =>
    (await admin.from('printers').insert({ name: 'Bench', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200, capacity: 10, ...row }).select('id').single()).data!.id as string
  printers.a1 = await machine({ owner_org_id: orgA })
  printers.a2 = await machine({ owner_org_id: orgA })
  printers.b = await machine({ owner_org_id: orgB })
  printers.maker = await machine({ owner_id: maker.id })
  const drop = (org_id: string, status: string, weighed: number | null, creditG: number | null) => ({
    org_id, contributor_id: family.id, material: 'PLA', estimated_grams: 2500, condition_declared: true,
    declaration_version: DECLARATION_VERSION, status, weighed_grams: weighed, credit_grams: creditG, decided_by: status === 'booked' ? null : leadA.id,
  })
  await admin.from('recycling_dropoffs').insert([
    drop(orgA, 'received', 400, 300),
    drop(orgA, 'declined', null, null),
    drop(orgA, 'booked', null, null),
    drop(orgB, 'received', 2000, 0),
  ])
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().in('tutorial_id', guides)
  await admin.from('printers').delete().in('id', Object.values(printers))
  await admin.from('tutorials').delete().in('id', guides)
  await admin.from('recycling_dropoffs').delete().eq('contributor_id', family.id)
  await admin.from('organizations').delete().in('id', [orgA, orgB])
  await Promise.all([family, leadA, leadB, maker].map((u) => deleteTestUser(u.id)))
})

describe('114 objects', () => {
  it('has the spends table, the balance function and the column', async () => {
    const admin = adminClient()
    expect((await admin.from('recycling_credit_spends').select('id').limit(1)).error).toBeNull()
    expect((await admin.from('toy_transactions').select('print_credit_grams').limit(1)).error).toBeNull()
    expect((await admin.rpc('recycling_credit_balance', { p_profile: family.id, p_org: orgA })).data).toBe(300)
  })

  it('keeps the balance function and the ledger away from clients', async () => {
    const db = createUserClient(family.token)
    expect((await db.rpc('recycling_credit_balance', { p_profile: family.id, p_org: orgA })).error).not.toBeNull()
    const { error } = await db.from('recycling_credit_spends').insert({ profile_id: family.id, org_id: orgA, transaction_id: crypto.randomUUID(), grams: 1 })
    expect(error).not.toBeNull()
  })
})

describe('GET /api/organizations/recycling/credit', () => {
  it('is received credit minus spends, per organisation, leaving out empty ones', async () => {
    expect(await credit()).toEqual([{ org_id: orgA, org_name: expect.any(String), grams: 300, weighed_grams: 400 }])
  })
})

describe('asking with credit', () => {
  it.each([
    [{ org_id: 'x', grams: 1.5 }, 'Say how many grams of credit, in whole grams.'],
    [{ grams: 50 }, 'Say how many grams of credit, in whole grams.'],
    [{ org_id: 'x', grams: 1000001 }, 'One job can use at most 1,000,000 g of credit.'],
  ])('refuses %j', async (print_credit, message) => {
    const res = await ask(0, [printers.a1], { print_credit })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe(message)
  })

  it('refuses credit at an organisation not being asked', async () => {
    const res = await ask(0, [printers.b], { print_credit: { org_id: orgA, grams: 50 } })
    expect(((await res.json()) as { error: string }).error).toBe('Credit can only be spent at the organisation that issued it.')
  })

  it('refuses more than the job needs, and more than the balance', async () => {
    const over = await ask(0, [printers.a1], { print_credit: { org_id: orgA, grams: 101 } })
    expect(((await over.json()) as { error: string }).error).toBe('This job needs 100 g of filament, so that is the most credit it can use.')
    const broke = await ask(0, [printers.a1], { print_credit: { org_id: orgA, grams: 400 } }, 5)
    expect(((await broke.json()) as { error: string }).error).toBe('You have 300 g of credit there.')
  })

  it('refuses credit on a guide whose part has no grams', async () => {
    await adminClient().from('stl_files').update({ filament_grams: null }).eq('id', parts[5])
    const res = await ask(5, [printers.a1], { print_credit: { org_id: orgA, grams: 10 } })
    expect(((await res.json()) as { error: string }).error).toBe('This guide does not say how much filament its parts take, so credit cannot be used on it.')
  })

  it('stores the credit only on that organisation’s rows, and the database refuses it elsewhere', async () => {
    const res = await ask(0, [printers.a1, printers.maker], { print_credit: { org_id: orgA, grams: 100 } })
    expect(res.status).toBe(201)
    expect((await jobOn(0, printers.a1)).print_credit_grams).toBe(100)
    expect((await jobOn(0, printers.maker)).print_credit_grams).toBeNull()
    const { error } = await adminClient().from('toy_transactions').update({ print_credit_grams: 5 }).eq('id', (await jobOn(0, printers.maker)).id)
    expect(error?.code).toBe('23514')
  })
})

describe('accepting', () => {
  it('spends nothing when a personal printer takes it', async () => {
    const job = await jobOn(0, printers.maker)
    expect((await app.request(`/api/toy-transactions/${job.id}/accept`, json(maker.token, 'POST', pickup))).status).toBe(200)
    expect(await spends()).toEqual([])
  })

  it('spends nothing when a different organisation’s printer takes it', async () => {
    expect((await ask(1, [printers.a1, printers.b], { print_credit: { org_id: orgA, grams: 100 } })).status).toBe(201)
    const job = await jobOn(1, printers.b)
    expect((await app.request(`/api/toy-transactions/${job.id}/accept`, json(leadB.token, 'POST', {}))).status).toBe(200)
    expect(await spends()).toEqual([])
  })

  it('spends once, in the accept, when the issuing organisation takes it', async () => {
    expect((await ask(2, [printers.a1], { print_credit: { org_id: orgA, grams: 100 } })).status).toBe(201)
    const job = await jobOn(2, printers.a1)
    expect((await app.request(`/api/toy-transactions/${job.id}/accept`, json(leadA.token, 'POST', {}))).status).toBe(200)
    expect((await app.request(`/api/toy-transactions/${job.id}/accept`, json(leadA.token, 'POST', {}))).status).toBe(409)
    expect(await spends()).toEqual([{ transaction_id: job.id, grams: 100, org_id: orgA }])
    expect((await credit())[0].grams).toBe(200)
    const dup = await adminClient().from('recycling_credit_spends').insert({ profile_id: family.id, org_id: orgA, transaction_id: job.id, grams: 1 })
    expect(dup.error?.code).toBe('23505')
  })

  it('accepts without credit when the balance ran out, and says so in the thread', async () => {
    // Balance 200: two jobs of 200 g each asking 150 g pass at request time.
    expect((await ask(3, [printers.a1], { print_credit: { org_id: orgA, grams: 150 } }, 2)).status).toBe(201)
    expect((await ask(4, [printers.a2], { print_credit: { org_id: orgA, grams: 150 } }, 2)).status).toBe(201)
    const first = await jobOn(3, printers.a1)
    const second = await jobOn(4, printers.a2)
    expect((await app.request(`/api/toy-transactions/${first.id}/accept`, json(leadA.token, 'POST', {}))).status).toBe(200)
    const res = await app.request(`/api/toy-transactions/${second.id}/accept`, json(leadA.token, 'POST', {}))
    expect(res.status).toBe(200)
    expect(((await res.json()) as { print_credit_grams: number | null }).print_credit_grams).toBeNull()
    expect((await spends()).filter((s) => s.transaction_id === second.id)).toEqual([])
    const { data: said } = await adminClient().from('toy_transaction_messages').select('body').eq('transaction_id', second.id)
    expect(said!.map((m) => m.body)).toContainEqual(expect.stringMatching(/^There was not enough recycling credit left at .+ for this job, so it was accepted without credit\.$/))
  })

  it('never overdraws when two accepts race on the last of the balance', async () => {
    // Balance 50 now. Two requests of 50 g each, accepted at the same moment.
    await adminClient().from('stl_files').update({ filament_grams: 100 }).eq('id', parts[5])
    expect((await ask(5, [printers.a1], { print_credit: { org_id: orgA, grams: 50 } })).status).toBe(201)
    expect((await ask(1, [printers.a2], { print_credit: { org_id: orgA, grams: 50 } })).status).toBe(201)
    const x = await jobOn(5, printers.a1)
    const y = await jobOn(1, printers.a2)
    const [rx, ry] = await Promise.all([
      app.request(`/api/toy-transactions/${x.id}/accept`, json(leadA.token, 'POST', {})),
      app.request(`/api/toy-transactions/${y.id}/accept`, json(leadA.token, 'POST', {})),
    ])
    expect([rx.status, ry.status]).toEqual([200, 200])
    const raced = (await spends()).filter((s) => s.transaction_id === x.id || s.transaction_id === y.id)
    expect(raced).toHaveLength(1)
    expect((await adminClient().rpc('recycling_credit_balance', { p_profile: family.id, p_org: orgA })).data).toBe(0)
  })
})
