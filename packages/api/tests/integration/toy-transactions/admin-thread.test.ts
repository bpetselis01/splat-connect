import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

const BASE = 'http://localhost'
const ADDRESS = { pickup_line1: '1 Test St', pickup_suburb: 'Testville', pickup_state: 'VIC', pickup_postcode: '3000' }

function toysReq(path: string, token: string, init: RequestInit = {}) {
  return app.request(`${BASE}/api/toys${path === '/' ? '' : path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}
function txReq(path: string, token: string, init: RequestInit = {}) {
  return app.request(`${BASE}/api/toy-transactions${path === '/' ? '' : path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}
const post = (path: string, token: string, body: unknown = {}) =>
  txReq(path, token, { method: 'POST', body: JSON.stringify(body) })

async function openDonation(ownerToken: string, requesterToken: string, name: string) {
  const create = await toysReq('/', ownerToken, { method: 'POST', body: JSON.stringify({ name, condition: 7 }) })
  const toy = (await create.json()) as { id: string }
  await toysReq(`/${toy.id}`, ownerToken, {
    method: 'PATCH',
    body: JSON.stringify({ photo_urls: ['https://example.com/c.jpg'], offer_type: 'donation' }),
  })
  await toysReq(`/${toy.id}/publish`, ownerToken, { method: 'PATCH' })
  const created = await post('/', requesterToken, { toy_id: toy.id, type: 'donation' })
  return ((await created.json()) as { id: string }).id
}

describe('an admin in a member thread', () => {
  let owner: TestUser
  let requester: TestUser
  let admin: TestUser
  let txId: string

  beforeAll(async () => {
    owner = await createTestUser('contributor')
    requester = await createTestUser('contributor')
    admin = await createTestUser('admin')
    txId = await openDonation(owner.token, requester.token, 'Blocks')
  })

  afterAll(async () => {
    await Promise.all([owner, requester, admin].map((u) => deleteTestUser(u.id)))
  })

  const status = async () =>
    ((await (await txReq(`/${txId}`, owner.token)).json()) as { status: string }).status

  it('WM37 reads a thread they are not part of', async () => {
    const res = await txReq(`/${txId}`, admin.token)
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ id: txId, status: 'requested' })
  })

  it('WM37 X16 posts a message stored as kind admin, and both parties are told', async () => {
    const res = await post(`/${txId}/messages`, admin.token, { body: 'Checking in on this one' })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ kind: 'admin', sender_id: admin.id, body: 'Checking in on this one' })

    const seen = (await (await txReq(`/${txId}`, requester.token)).json()) as {
      messages: { kind: string; body: string }[]
    }
    expect(seen.messages.at(-1)).toMatchObject({ kind: 'admin', body: 'Checking in on this one' })

    const { data: notes } = await adminClient()
      .from('notifications')
      .select('recipient_id, type, actor_name, body')
      .eq('toy_transaction_id', txId)
      .eq('type', 'toy_message')
    expect(notes?.sort((a, b) => a.recipient_id.localeCompare(b.recipient_id))).toEqual(
      [owner.id, requester.id].sort().map((recipient_id) => ({
        recipient_id,
        type: 'toy_message',
        actor_name: 'SPLAT admin',
        body: 'Checking in on this one',
      }))
    )
  })

  it('WM37 refuses an empty admin message', async () => {
    expect((await post(`/${txId}/messages`, admin.token, { body: '   ' })).status).toBe(400)
  })

  it('WM38 refuses accept, reject, withdraw and confirm, and leaves the request open', async () => {
    for (const [action, body] of [
      ['accept', ADDRESS],
      ['reject', { reason: 'Nope' }],
      ['withdraw', {}],
      ['confirm', { code: '000000' }],
    ] as const) {
      const res = await post(`/${txId}/${action}`, admin.token, body)
      expect(res.status, action).toBe(403)
      expect(await res.json(), action).toEqual({ error: 'Admins can read this thread but cannot act on it.' })
    }
    expect(await status()).toBe('requested')
  })

  it('still answers a member stranger with 404 on messages and actions', async () => {
    const stranger = await createTestUser('contributor')
    try {
      expect((await post(`/${txId}/messages`, stranger.token, { body: 'hi' })).status).toBe(404)
      expect((await post(`/${txId}/withdraw`, stranger.token)).status).toBe(404)
    } finally {
      await deleteTestUser(stranger.id)
    }
  })

  it('WM37 a party cannot insert an admin or system message through PostgREST', async () => {
    const asRequester = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${requester.token}` } },
    })
    const insert = (kind: string) =>
      asRequester.from('toy_transaction_messages').insert({ transaction_id: txId, sender_id: requester.id, kind, body: 'forged' })

    expect((await insert('admin')).error?.code).toBe('42501')
    expect((await insert('system')).error?.code).toBe('42501')
    expect((await insert('user')).error).toBeNull()
  })

  it('WM37 an admin who is a party posts as a member and can accept', async () => {
    const mine = await openDonation(admin.token, requester.token, 'Admin toy')
    const res = await post(`/${mine}/messages`, admin.token, { body: 'Happy to hand this over' })
    expect(res.status).toBe(201)
    expect(await res.json()).toMatchObject({ kind: 'user', sender_id: admin.id })

    const accepted = await post(`/${mine}/accept`, admin.token, ADDRESS)
    expect(accepted.status).toBe(200)
    expect(await accepted.json()).toMatchObject({ status: 'accepted' })
  })
})

describe('an admin on an open build request', () => {
  let family: TestUser
  let admin: TestUser
  let tutorialId: string
  let buildId: string

  beforeAll(async () => {
    ;[family, admin] = await Promise.all([createTestUser('contributor'), createTestUser('admin')])
    const db = adminClient()
    const t = await db.from('tutorials').insert({ title: `Admin build ${Date.now()}`, description: 'G', difficulty: 'easy', status: 'approved' }).select('id').single()
    if (t.error) throw t.error
    tutorialId = t.data.id
    const tx = await db
      .from('toy_transactions')
      .insert({ type: 'build', status: 'requested', tutorial_id: tutorialId, requester_id: family.id, travel_km: 10, requester_suburb: 'Newtown' })
      .select('id')
      .single()
    if (tx.error) throw tx.error
    buildId = tx.data.id
  })

  afterAll(async () => {
    const db = adminClient()
    await db.from('build_request_questions').delete().eq('transaction_id', buildId)
    await db.from('notifications').delete().eq('toy_transaction_id', buildId)
    await db.from('toy_transactions').delete().eq('id', buildId)
    await db.from('tutorials').delete().eq('id', tutorialId)
    await Promise.all([family, admin].map((u) => deleteTestUser(u.id)))
  })

  it('WM38 refuses a claim and leaves the build open', async () => {
    const res = await post(`/${buildId}/claim`, admin.token)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Admins can read this thread but cannot act on it.' })
    const { data } = await adminClient().from('toy_transactions').select('status, owner_id').eq('id', buildId).single()
    expect(data).toEqual({ status: 'requested', owner_id: null })
  })

  it('WM38 refuses a question asked as the maker and stores nothing', async () => {
    const res = await post(`/${buildId}/questions`, admin.token, { body: 'Which switch?' })
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: 'Admins can read this thread but cannot act on it.' })
    const { data } = await adminClient().from('build_request_questions').select('id').eq('transaction_id', buildId)
    expect(data).toEqual([])
  })
})
