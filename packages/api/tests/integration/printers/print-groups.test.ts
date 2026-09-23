/**
 * One request, up to three printers (074).
 *
 * - **The first to accept takes it.** The others are withdrawn for the family
 *   and told, so nobody prints it twice.
 * - **Exactly one winner, even in a race.** A partial unique index decides it,
 *   not a read-then-write check; the loser is told plainly.
 * - **An organisation picks its machine.** The leader may accept onto any of the
 *   org's open printers, and the choice is stamped on the job.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader } from '../../helpers/orgs.js'

let family: TestUser
let a: TestUser
let b: TestUser
let c: TestUser
let leader: TestUser
let tutorialId: string
let stlIds: string[] = []
const printers: Record<string, string> = {}
let orgId: string

const json = (token: string, method: string, body?: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})
const pickup = { pickup_line1: '1 Test St', pickup_suburb: 'Newtown', pickup_state: 'NSW', pickup_postcode: '2042' }

async function ask(printerIds: string[], extra: Record<string, unknown> = {}) {
  return app.request(
    '/api/toy-transactions/print',
    json(family.token, 'POST', { printer_ids: printerIds, tutorial_id: tutorialId, stl_file_ids: stlIds, ...extra })
  )
}

beforeAll(async () => {
  ;[family, a, b, c, leader] = await Promise.all([1, 2, 3, 4, 5].map(() => createTestUser('contributor')))
  const admin = adminClient()
  const { data: t } = await admin
    .from('tutorials')
    .insert({ title: 'Grouped print', description: 'x', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = t!.id
  const { data: files } = await admin
    .from('stl_files')
    .insert([{ tutorial_id: tutorialId, filename: 'part.stl', file_url: `${tutorialId}/part.stl` }])
    .select('id')
  stlIds = files!.map((f: { id: string }) => f.id)

  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  const machine = (row: Record<string, unknown>) =>
    admin
      .from('printers')
      .insert({ name: 'Printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200, capacity: 3, ...row })
      .select('id')
      .single()
      .then(({ data }) => data!.id as string)
  printers.a = await machine({ owner_id: a.id })
  printers.b = await machine({ owner_id: b.id })
  printers.c = await machine({ owner_id: c.id })
  printers.org1 = await machine({ owner_org_id: orgId, name: 'Bench one' })
  printers.org2 = await machine({ owner_org_id: orgId, name: 'Bench two' })
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await admin.from('printers').delete().in('id', Object.values(printers))
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await admin.from('organizations').delete().eq('id', orgId)
  await Promise.all([family, a, b, c, leader].map((u) => deleteTestUser(u.id)))
})

describe('asking several printers', () => {
  it('refuses more than three', async () => {
    const res = await ask([printers.a, printers.b, printers.c, printers.org1])
    expect(res.status).toBe(400)
  })

  it('sends one job per printer, sharing a group, with colour and delivery on each', async () => {
    const res = await ask([printers.a, printers.b], { colour: 'Blue', delivery: 'post' })
    expect(res.status).toBe(201)
    const body = (await res.json()) as { print_group_id: string; transactions: Array<Record<string, any>> }
    expect(body.transactions).toHaveLength(2)
    for (const tx of body.transactions) {
      expect(tx.print_group_id).toBe(body.print_group_id)
      expect(tx.print_colour).toBe('Blue')
      expect(tx.print_delivery).toBe('post')
    }
    const detail = await app.request(`/api/toy-transactions/${body.transactions[0].id}`, json(family.token, 'GET'))
    expect(((await detail.json()) as { print_group_size: number }).print_group_size).toBe(2)
  })

  it('withdraws the others when one accepts, and tells them', async () => {
    const admin = adminClient()
    const { data: jobs } = await admin
      .from('toy_transactions')
      .select('id, printer_id')
      .eq('tutorial_id', tutorialId)
      .eq('status', 'requested')
    const jobA = jobs!.find((j) => j.printer_id === printers.a)!.id
    const jobB = jobs!.find((j) => j.printer_id === printers.b)!.id

    const accepted = await app.request(`/api/toy-transactions/${jobA}/accept`, json(a.token, 'POST', pickup))
    expect(accepted.status).toBe(200)

    const { data: sibling } = await admin.from('toy_transactions').select('status').eq('id', jobB).single()
    expect(sibling!.status).toBe('withdrawn')
    const { data: told } = await admin
      .from('notifications')
      .select('type')
      .eq('recipient_id', b.id)
      .eq('toy_transaction_id', jobB)
    expect(told!.map((n) => n.type)).toContain('toy_withdrawn')

    const late = await app.request(`/api/toy-transactions/${jobB}/accept`, json(b.token, 'POST', pickup))
    expect(late.status).toBe(409)
  })

  it('lets exactly one win a race — the second commit is refused by the index', async () => {
    const res = await ask([printers.c, printers.org1])
    const { transactions } = (await res.json()) as { transactions: Array<{ id: string; printer_id: string }> }
    const jobC = transactions.find((t) => t.printer_id === printers.c)!.id
    const jobOrg = transactions.find((t) => t.printer_id === printers.org1)!.id
    // The winner commits without the API's sibling sweep having run — exactly
    // the window a simultaneous accept lands in.
    await adminClient().from('toy_transactions').update({ status: 'accepted' }).eq('id', jobC)
    await adminClient().from('organizations').update({ pickup_line1: '1 Org St', pickup_suburb: 'Newtown', pickup_state: 'NSW', pickup_postcode: '2042' }).eq('id', orgId)
    const loser = await app.request(`/api/toy-transactions/${jobOrg}/accept`, json(leader.token, 'POST', {}))
    expect(loser.status).toBe(409)
    expect(((await loser.json()) as { error: string }).error).toMatch(/already taken/)
    const { data } = await adminClient().from('toy_transactions').select('status').eq('id', jobOrg).single()
    expect(data!.status).toBe('withdrawn')
  })
})

describe('an organisation choosing its machine', () => {
  it('stamps the bench the leader accepts on, and refuses one that is not theirs', async () => {
    const res = await ask([printers.org1])
    const { id } = (await res.json()) as { id: string }

    const wrong = await app.request(`/api/toy-transactions/${id}/accept`, json(leader.token, 'POST', { printer_id: printers.a }))
    expect(wrong.status).toBe(404)

    const ok = await app.request(`/api/toy-transactions/${id}/accept`, json(leader.token, 'POST', { printer_id: printers.org2 }))
    expect(ok.status).toBe(200)
    const { data } = await adminClient().from('toy_transactions').select('printer_id, status').eq('id', id).single()
    expect(data).toEqual({ printer_id: printers.org2, status: 'accepted' })
  })
})
