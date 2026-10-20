/**
 * The exchange-outcome notifications (142): a decision or a handover that the
 * other person was waiting on now reaches their inbox. Each `it` title names
 * its type; scripts/journeys/notifications.mjs matches it as a whole word.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { DECLARATION_VERSION } from '@splat-connect/types'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { nameUser, notesAbout } from '../../helpers/notifications.js'

const call = (token: string, method: string, path: string, body?: unknown) =>
  app.request(`http://localhost/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })

let admin: TestUser
let leader: TestUser
let leaderTwo: TestUser
let contributor: TestUser
let requester: TestUser
let owner: TestUser
let family: TestUser
let orgId: string
const orgName = `Handoff Org ${Date.now()}`
const createdOrgs: string[] = []
const printerIds: string[] = []

async function noticesFor(recipient: string, type: string) {
  const { data } = await adminClient()
    .from('notifications')
    .select('type, actor_name, body, org_id')
    .eq('recipient_id', recipient)
    .eq('type', type)
  return data ?? []
}

async function booked() {
  const { data } = await adminClient()
    .from('recycling_dropoffs')
    .insert({
      org_id: orgId,
      contributor_id: contributor.id,
      material: 'PLA',
      estimated_grams: 3000,
      condition_declared: true,
      declaration_version: DECLARATION_VERSION,
    })
    .select('id')
    .single()
  return data!.id as string
}

async function orgRequest(name: string) {
  const { data } = await adminClient()
    .from('organization_requests')
    .insert({ requester_id: requester.id, org_name: name, what_they_do: 'Builds switch toys.', verification: 'Work email.' })
    .select('id')
    .single()
  return data!.id as string
}

async function printer(fields: { owner_id?: string; owner_org_id?: string }) {
  const { data } = await adminClient()
    .from('printers')
    .insert({ ...fields, name: 'Bench printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 })
    .select('id')
    .single()
  printerIds.push(data!.id)
  const { data: print } = await adminClient()
    .from('printer_test_prints')
    .insert({ printer_id: data!.id, photo_path: `${data!.id}/${crypto.randomUUID()}.png` })
    .select('id')
    .single()
  return print!.id as string
}

async function exchangeAccepted(kind: 'exchange' | 'donation' = 'exchange') {
  const publish = async (who: TestUser, name: string, offer = 'exchange') => {
    const toy = (await (await call(who.token, 'POST', '/toys', { name, condition: 7 })).json()) as { id: string }
    await call(who.token, 'PATCH', `/toys/${toy.id}`, { photo_urls: ['https://example.com/c.jpg'], offer_type: offer })
    await call(who.token, 'PATCH', `/toys/${toy.id}/publish`)
    return toy.id
  }
  const res = await call(family.token, 'POST', '/toy-transactions', {
    toy_id: await publish(owner, 'Kite', kind),
    type: kind,
    ...(kind === 'exchange' ? { offered_toy_id: await publish(family, 'Yo-yo') } : {}),
  })
  const id = ((await res.json()) as { id: string }).id
  await call(owner.token, 'POST', `/toy-transactions/${id}/accept`, {
    pickup_line1: '1 Test St', pickup_suburb: 'Testville', pickup_state: 'VIC', pickup_postcode: '3000',
  })
  const code = async (who: TestUser, field: string) =>
    ((await (await call(who.token, 'GET', `/toy-transactions/${id}`)).json()) as Record<string, string>)[field]
  return { id, familyCode: await code(family, 'requester_code'), ownerCode: await code(owner, 'owner_code') }
}

beforeAll(async () => {
  ;[admin, leader, leaderTwo, contributor, requester, owner, family] = await Promise.all(
    ['admin', 'contributor', 'contributor', 'contributor', 'contributor', 'contributor', 'contributor'].map((r) =>
      createTestUser(r as 'admin' | 'contributor')
    )
  )
  await nameUser(owner.id, 'Olive Owner')
  await nameUser(family.id, 'Fern Family')
  const sb = adminClient()
  const { data: org } = await sb.from('organizations').insert({ name: orgName, status: 'active' }).select('id').single()
  orgId = org!.id
  await sb.from('org_leaders').insert([
    { org_id: orgId, user_id: leader.id },
    { org_id: orgId, user_id: leaderTwo.id },
  ])
})

afterAll(async () => {
  const sb = adminClient()
  await sb.from('recycling_dropoffs').delete().eq('org_id', orgId)
  await sb.from('printers').delete().in('id', printerIds)
  await sb.from('organization_requests').delete().eq('requester_id', requester.id)
  await sb.from('org_leaders').delete().in('org_id', [orgId, ...createdOrgs])
  await sb.from('organizations').delete().in('id', [orgId, ...createdOrgs])
  await Promise.all([admin, leader, leaderTwo, contributor, requester, owner, family].map((u) => deleteTestUser(u.id)))
})

describe('recycling decisions', () => {
  it('recycling_received tells the contributor which organisation weighed it in', async () => {
    const id = await booked()
    const res = await call(leader.token, 'PATCH', `/organizations/${orgId}/recycling/${id}`, {
      status: 'received', weighed_grams: 3000, credit_grams: 2000,
    })
    expect(res.status).toBe(200)
    expect(await noticesFor(contributor.id, 'recycling_received')).toEqual([
      { type: 'recycling_received', actor_name: orgName, body: null, org_id: orgId },
    ])
    expect(await noticesFor(leader.id, 'recycling_received')).toEqual([])
  })

  it('recycling_declined tells the contributor, and a repeat decision sends nothing more', async () => {
    const id = await booked()
    expect((await call(leader.token, 'PATCH', `/organizations/${orgId}/recycling/${id}`, { status: 'declined' })).status).toBe(200)
    expect((await call(leader.token, 'PATCH', `/organizations/${orgId}/recycling/${id}`, { status: 'declined' })).status).toBe(409)
    expect(await noticesFor(contributor.id, 'recycling_declined')).toEqual([
      { type: 'recycling_declined', actor_name: orgName, body: null, org_id: orgId },
    ])
  })
})

describe('organisation requests', () => {
  it('org_request_approved tells the requester once, with the admin note and the new organisation', async () => {
    const id = await orgRequest(`Approved Org ${Date.now()}`)
    const first = await call(admin.token, 'POST', `/admin/organization-requests/${id}/approve`, { note: 'Welcome aboard' })
    expect(first.status).toBe(200)
    const { organization_id } = (await first.json()) as { organization_id: string }
    createdOrgs.push(organization_id)
    expect((await call(admin.token, 'POST', `/admin/organization-requests/${id}/approve`, {})).status).toBe(200)
    const rows = await noticesFor(requester.id, 'org_request_approved')
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ body: 'Welcome aboard', org_id: organization_id })
  })

  it('org_request_declined tells the requester with the reason as the body', async () => {
    const id = await orgRequest('Declined Org')
    expect((await call(admin.token, 'POST', `/admin/organization-requests/${id}/decline`, { note: 'Need a work email' })).status).toBe(200)
    expect(await noticesFor(requester.id, 'org_request_declined')).toEqual([
      { type: 'org_request_declined', actor_name: 'Declined Org', body: 'Need a work email', org_id: null },
    ])
  })
})

describe('test print verdicts', () => {
  it('test_print_passed tells the owner of a personal printer, with no organisation subject', async () => {
    const id = await printer({ owner_id: owner.id })
    expect((await call(admin.token, 'PATCH', `/admin/test-prints/${id}`, { verdict: 'pass', note: 'Clean layers.' })).status).toBe(200)
    expect(await noticesFor(owner.id, 'test_print_passed')).toEqual([
      { type: 'test_print_passed', actor_name: 'Bench printer', body: 'Clean layers.', org_id: null },
    ])
  })

  it('test_print_failed tells every current leader of an organisation-owned printer', async () => {
    const id = await printer({ owner_org_id: orgId })
    expect((await call(admin.token, 'PATCH', `/admin/test-prints/${id}`, { verdict: 'fail', note: 'Stringing.' })).status).toBe(200)
    for (const who of [leader, leaderTwo]) {
      expect(await noticesFor(who.id, 'test_print_failed')).toEqual([
        { type: 'test_print_failed', actor_name: 'Bench printer', body: 'Stringing.', org_id: orgId },
      ])
    }
  })
})

describe('handover', () => {
  it('handover_confirmed tells the other party on the first confirm and nothing on the second', async () => {
    const tx = await exchangeAccepted()
    expect((await call(owner.token, 'POST', `/toy-transactions/${tx.id}/confirm`, { code: tx.familyCode })).status).toBe(200)
    expect((await call(owner.token, 'POST', `/toy-transactions/${tx.id}/confirm`, { code: tx.familyCode })).status).toBe(200)
    const told = (await notesAbout(family.id, tx.id)).filter((n) => n.type === 'handover_confirmed')
    expect(told).toEqual([
      { recipient_id: family.id, type: 'handover_confirmed', toy_transaction_id: tx.id, toy_name: 'Kite', actor_name: 'Olive Owner', body: null },
    ])
    expect((await call(family.token, 'POST', `/toy-transactions/${tx.id}/confirm`, { code: tx.ownerCode })).status).toBe(200)
    expect((await notesAbout(owner.id, tx.id)).filter((n) => n.type === 'handover_confirmed')).toEqual([])
  })

  it('handover_confirmed tells the requester when the owner confirms a donation', async () => {
    const tx = await exchangeAccepted('donation')
    expect((await call(owner.token, 'POST', `/toy-transactions/${tx.id}/confirm`, { code: tx.familyCode })).status).toBe(200)
    expect((await notesAbout(family.id, tx.id)).filter((n) => n.type === 'handover_confirmed')).toEqual([
      { recipient_id: family.id, type: 'handover_confirmed', toy_transaction_id: tx.id, toy_name: 'Kite', actor_name: 'Olive Owner', body: null },
    ])
    expect((await notesAbout(owner.id, tx.id)).filter((n) => n.type === 'handover_confirmed')).toEqual([])
  })
})
