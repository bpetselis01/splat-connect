/**
 * Makers wanted: a build request with nobody on the other end of it.
 *
 * The rules with teeth:
 *
 * - **Ownerless is legal for exactly one shape.** 064 widened
 *   `toy_transactions_one_owner` to admit an unclaimed BUILD that is still
 *   REQUESTED, and nothing else. Widen it further by accident and a donation
 *   could be written with nobody responsible for handing the toy over — which
 *   every accept, confirm and handoff check reads as "not my row" and silently
 *   ignores.
 * - **A claim is atomic.** Two makers pressing the button in the same second
 *   resolve to one winner and one 409, not to whoever wrote last.
 * - **The board never returns the requester's name.** The card says "Family in
 *   Newtown", and that is the whole of what a maker gets before they claim.
 * - **An open request needs a suburb and a range**, because there is nobody to
 *   ask: a card that cannot say where the family is and how far they can get is
 *   a card no maker can act on.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let makerA: TestUser
let makerB: TestUser
let tutorialId: string

const authed = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })
const json = (token: string, method: string, body: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const ask = (over: Record<string, unknown> = {}) => ({
  tutorial_id: tutorialId,
  build_brief: 'Leo lights up at bubbles but I do not own a soldering iron.',
  child_label: 'Leo, 3',
  requester_suburb: 'Newtown',
  travel_km: 10,
  urgency: 'No rush',
  ...over,
})

beforeAll(async () => {
  family = await createTestUser('contributor')
  makerA = await createTestUser('contributor')
  makerB = await createTestUser('contributor')
  const admin = adminClient()
  const { data } = await admin
    .from('tutorials')
    .insert({
      title: `Open build guide ${Date.now()}`,
      description: 'A guide',
      difficulty: 'easy',
      status: 'approved',
    })
    .select('id')
    .single()
  tutorialId = data!.id
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([
    deleteTestUser(family.id),
    deleteTestUser(makerA.id),
    deleteTestUser(makerB.id),
  ])
})

describe('posting to the board', () => {
  it('refuses an open request with no suburb or no range', async () => {
    for (const missing of [{ requester_suburb: '' }, { travel_km: null }]) {
      const res = await app.request(
        '/api/toy-transactions/build',
        json(family.token, 'POST', ask(missing))
      )
      expect(res.status, JSON.stringify(missing)).toBe(400)
    }
  })

  it('still refuses naming two makers', async () => {
    const res = await app.request(
      '/api/toy-transactions/build',
      json(family.token, 'POST', ask({ maker_id: makerA.id, maker_org_id: 'x' }))
    )
    expect(res.status).toBe(400)
  })

  it('posts one with no maker at all', async () => {
    const res = await app.request('/api/toy-transactions/build', json(family.token, 'POST', ask()))
    expect(res.status).toBe(201)
    const tx = (await res.json()) as {
      id: string
      owner_id: string | null
      owner_org_id: string | null
      status: string
      travel_km: number
    }
    expect(tx.owner_id).toBeNull()
    expect(tx.owner_org_id).toBeNull()
    expect(tx.status).toBe('requested')
    expect(tx.travel_km).toBe(10)
  })

  // Chain: 064's constraint, checked from outside. An ownerless donation would
  //        be a toy nobody is responsible for handing over.
  it('refuses an ownerless transaction of any other shape', async () => {
    const admin = adminClient()
    const { error } = await admin.from('toy_transactions').insert({
      toy_id: null,
      tutorial_id: tutorialId,
      type: 'donation',
      status: 'requested',
      requester_id: family.id,
      owner_id: null,
      owner_org_id: null,
    })
    expect(error).not.toBeNull()
  })
})

describe('the board', () => {
  it('lists the open request without the requester', async () => {
    const res = await app.request('/api/toy-transactions/open-builds', authed(makerA.token))
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<Record<string, unknown>>
    const mine = rows.find((r) => r.tutorial_id === tutorialId)
    expect(mine).toBeTruthy()
    expect(mine!.requester_suburb).toBe('Newtown')
    // The guide resolves. It rendered as "no longer published" on every card
    // while the select named a column the table does not have — supabase-js
    // fails the whole query for that and returns null, with no error surfaced
    // anywhere the page could see.
    expect((mine!.tutorial as { title: string } | null)?.title).toBeTruthy()
    // The name is not in the payload at all, under any key.
    expect(JSON.stringify(mine)).not.toContain(family.id)
    expect(mine!.mine).toBe(false)
  })

  it('tells the family which row is their own', async () => {
    const rows = (await (
      await app.request('/api/toy-transactions/open-builds', authed(family.token))
    ).json()) as Array<{ tutorial_id: string; mine: boolean }>
    expect(rows.find((r) => r.tutorial_id === tutorialId)!.mine).toBe(true)
  })

  // RLS lets a maker read an open request so they can claim it, and the list
  // route used to return everything RLS allowed — so the family's name and id,
  // which the board above deliberately withholds, sat on every maker's
  // exchange list as if the request were theirs.
  it('keeps the open request off a maker\'s own exchange list, and on the family\'s', async () => {
    const theirs = (await (
      await app.request('/api/toy-transactions', authed(makerA.token))
    ).json()) as Array<{ tutorial_id: string | null; requester_id: string }>
    expect(theirs.some((r) => r.requester_id === family.id)).toBe(false)
    expect(JSON.stringify(theirs)).not.toContain(family.id)

    const mine = (await (
      await app.request('/api/toy-transactions', authed(family.token))
    ).json()) as Array<{ tutorial_id: string | null }>
    expect(mine.some((r) => r.tutorial_id === tutorialId)).toBe(true)
  })
})

describe('claiming', () => {
  let openId: string

  beforeAll(async () => {
    const rows = (await (
      await app.request('/api/toy-transactions/open-builds', authed(makerA.token))
    ).json()) as Array<{ id: string; tutorial_id: string }>
    openId = rows.find((r) => r.tutorial_id === tutorialId)!.id
  })

  it('refuses the family claiming their own request', async () => {
    const res = await app.request(`/api/toy-transactions/${openId}/claim`, json(family.token, 'POST', {}))
    expect(res.status).toBe(400)
  })

  // Chain: the write is conditional on the row still being unclaimed, so two
  //        makers in the same second resolve to one winner rather than to
  //        whoever wrote last — which would silently hand the family a
  //        different maker from the one they were told about.
  it('gives the request to exactly one of two simultaneous claims', async () => {
    const [a, b] = await Promise.all([
      app.request(`/api/toy-transactions/${openId}/claim`, json(makerA.token, 'POST', {})),
      app.request(`/api/toy-transactions/${openId}/claim`, json(makerB.token, 'POST', {})),
    ])
    const codes = [a.status, b.status].sort()
    expect(codes).toEqual([200, 409])

    const admin = adminClient()
    const { data } = await admin
      .from('toy_transactions')
      .select('owner_id, status, owner_code, requester_code')
      .eq('id', openId)
      .single()
    expect([makerA.id, makerB.id]).toContain(data!.owner_id)
    // The claim IS the accept: it fills in the owner and both handover codes,
    // so every stage after it is the ordinary build flow.
    expect(data!.status).toBe('accepted')
    expect(data!.owner_code).toBeTruthy()
    expect(data!.requester_code).toBeTruthy()
  })

  it('drops off the board once claimed', async () => {
    const rows = (await (
      await app.request('/api/toy-transactions/open-builds', authed(makerB.token))
    ).json()) as Array<{ id: string }>
    expect(rows.map((r) => r.id)).not.toContain(openId)
  })
})
