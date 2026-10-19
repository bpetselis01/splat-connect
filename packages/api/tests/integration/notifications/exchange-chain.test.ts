/**
 * The toy exchange chain, one notification row per action: who is told, what
 * type, and which transaction it opens (toy_transaction_id is the link target).
 * The other exchange tests drive these routes for their state; this is the file
 * that asserts the inbox row they leave behind.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'
import { nameUser, notesAbout } from '../../helpers/notifications.js'

const api = (path: string, token: string, init: RequestInit = {}) =>
  app.request(`http://localhost/api${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
const post = (path: string, token: string, body: unknown = {}) =>
  api(path, token, { method: 'POST', body: JSON.stringify(body) })

const ADDRESS = { pickup_line1: '1 Test St', pickup_suburb: 'Testville', pickup_state: 'VIC', pickup_postcode: '3000' }

async function publishedToy(token: string, name: string, offer: 'donation' | 'exchange') {
  const toy = (await (await post('/toys', token, { name, condition: 7 })).json()) as { id: string }
  await api(`/toys/${toy.id}`, token, {
    method: 'PATCH',
    body: JSON.stringify({ photo_urls: ['https://example.com/c.jpg'], offer_type: offer }),
  })
  await api(`/toys/${toy.id}/publish`, token, { method: 'PATCH' })
  return toy.id
}

let owner: TestUser
let family: TestUser
let rival: TestUser

async function ask(toyId: string, who = family, extra: Record<string, unknown> = {}) {
  const res = await post('/toy-transactions', who.token, { toy_id: toyId, type: 'donation', ...extra })
  expect(res.status).toBe(201)
  return ((await res.json()) as { id: string }).id
}

beforeAll(async () => {
  ;[owner, family, rival] = await Promise.all([1, 2, 3].map(() => createTestUser('contributor')))
  await nameUser(owner.id, 'Olive Owner')
  await nameUser(family.id, 'Fern Family')
  await nameUser(rival.id, 'Rory Rival')
})

afterAll(async () => {
  await Promise.all([owner, family, rival].map((u) => deleteTestUser(u.id)))
})

describe('asking for a toy (Y05, Y06)', () => {
  it('Y05 a donation request tells the owner, naming the toy and the asker', async () => {
    const toyId = await publishedToy(owner.token, 'Fire truck', 'donation')
    const id = await ask(toyId)
    expect(await notesAbout(owner.id, id)).toEqual([
      { recipient_id: owner.id, type: 'toy_request', toy_transaction_id: id, toy_name: 'Fire truck', actor_name: 'Fern Family', body: null },
    ])
    expect(await notesAbout(family.id, id)).toEqual([])
  })

  it('Y06 an offer of the family’s own toy tells the owner the same way', async () => {
    const wanted = await publishedToy(owner.token, 'Kite', 'exchange')
    const offered = await publishedToy(family.token, 'Yo-yo', 'exchange')
    const res = await post('/toy-transactions', family.token, { toy_id: wanted, type: 'exchange', offered_toy_id: offered })
    expect(res.status).toBe(201)
    const id = ((await res.json()) as { id: string }).id
    const rows = await notesAbout(owner.id, id)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ type: 'toy_request', toy_name: 'Kite', actor_name: 'Fern Family' })
  })
})

describe('talking in the thread (X03)', () => {
  it('X03 each side’s message tells the other, carrying the message as the body', async () => {
    const id = await ask(await publishedToy(owner.token, 'Scooter', 'donation'))
    expect((await post(`/toy-transactions/${id}/messages`, owner.token, { body: 'Thursday after three?' })).status).toBe(201)
    expect((await post(`/toy-transactions/${id}/messages`, family.token, { body: 'Works for us' })).status).toBe(201)

    expect((await notesAbout(family.id, id)).filter((n) => n.type === 'toy_message')).toEqual([
      { recipient_id: family.id, type: 'toy_message', toy_transaction_id: id, toy_name: 'Scooter', actor_name: 'Olive Owner', body: 'Thursday after three?' },
    ])
    expect((await notesAbout(owner.id, id)).filter((n) => n.type === 'toy_message')).toEqual([
      { recipient_id: owner.id, type: 'toy_message', toy_transaction_id: id, toy_name: 'Scooter', actor_name: 'Fern Family', body: 'Works for us' },
    ])
  })
})

describe('the owner answering (W03, X04, X05)', () => {
  it('W03 X04 accepting tells the family, in the owner’s name', async () => {
    const id = await ask(await publishedToy(owner.token, 'Robot', 'donation'))
    expect((await post(`/toy-transactions/${id}/accept`, owner.token, ADDRESS)).status).toBe(200)
    expect(await notesAbout(family.id, id)).toEqual([
      { recipient_id: family.id, type: 'toy_accepted', toy_transaction_id: id, toy_name: 'Robot', actor_name: 'Olive Owner', body: null },
    ])
  })

  it('X05 declining tells the family, with the reason as the body', async () => {
    const id = await ask(await publishedToy(owner.token, 'Drum', 'donation'))
    expect((await post(`/toy-transactions/${id}/reject`, owner.token, { reason: 'Already promised' })).status).toBe(200)
    expect(await notesAbout(family.id, id)).toEqual([
      { recipient_id: family.id, type: 'toy_rejected', toy_transaction_id: id, toy_name: 'Drum', actor_name: 'Olive Owner', body: 'Already promised' },
    ])
  })
})

describe('withdrawing (X06)', () => {
  it('X06 the family withdrawing tells the owner', async () => {
    const id = await ask(await publishedToy(owner.token, 'Train', 'donation'))
    expect((await post(`/toy-transactions/${id}/withdraw`, family.token)).status).toBe(200)
    const rows = (await notesAbout(owner.id, id)).filter((n) => n.type === 'toy_withdrawn')
    expect(rows).toEqual([
      { recipient_id: owner.id, type: 'toy_withdrawn', toy_transaction_id: id, toy_name: 'Train', actor_name: 'Fern Family', body: null },
    ])
    expect((await notesAbout(family.id, id)).filter((n) => n.type === 'toy_withdrawn')).toEqual([])
  })

  it('X06 the owner withdrawing tells the family', async () => {
    const id = await ask(await publishedToy(owner.token, 'Blocks', 'donation'))
    expect((await post(`/toy-transactions/${id}/withdraw`, owner.token)).status).toBe(200)
    expect(await notesAbout(family.id, id)).toEqual([
      { recipient_id: family.id, type: 'toy_withdrawn', toy_transaction_id: id, toy_name: 'Blocks', actor_name: 'Olive Owner', body: null },
    ])
  })
})

describe('confirming the handover (X07)', () => {
  it('X07 a rival request is told it was declined once the toy has gone', async () => {
    const toyId = await publishedToy(owner.token, 'Rocking horse', 'donation')
    const id = await ask(toyId)
    const rivalId = await ask(toyId, rival)
    await post(`/toy-transactions/${id}/accept`, owner.token, ADDRESS)
    const { requester_code } = (await (await api(`/toy-transactions/${id}`, family.token)).json()) as { requester_code: string }
    expect((await post(`/toy-transactions/${id}/confirm`, owner.token, { code: requester_code })).status).toBe(200)
    expect(await notesAbout(rival.id, rivalId)).toEqual([
      { recipient_id: rival.id, type: 'toy_rejected', toy_transaction_id: rivalId, toy_name: 'Rocking horse', actor_name: 'Olive Owner', body: null },
    ])
  })
})
