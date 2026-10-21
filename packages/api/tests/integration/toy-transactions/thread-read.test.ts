/**
 * What the mobile Exchange thread and the My toys "offers on this toy" row read.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

const call = (u: TestUser, path: string, method = 'GET', body?: unknown) =>
  app.request(`http://localhost${path}`, {
    method,
    headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

let owner: TestUser
let requester: TestUser
let second: TestUser
let stranger: TestUser
let toyId: string
let txId: string
let secondTxId: string

beforeAll(async () => {
  ;[owner, requester, second, stranger] = await Promise.all([1, 2, 3, 4].map(() => createTestUser('contributor')))
  toyId = ((await (await call(owner, '/api/toys', 'POST', { name: 'Thread drum', condition: 8 })).json()) as { id: string }).id
  await call(owner, `/api/toys/${toyId}`, 'PATCH', { photo_urls: ['https://example.com/c.jpg'], offer_type: 'donation' })
  await call(owner, `/api/toys/${toyId}/publish`, 'PATCH')
  txId = ((await (await call(requester, '/api/toy-transactions', 'POST', { toy_id: toyId, type: 'donation' })).json()) as { id: string }).id
  secondTxId = ((await (await call(second, '/api/toy-transactions', 'POST', { toy_id: toyId, type: 'donation' })).json()) as { id: string }).id
})

afterAll(async () => {
  await Promise.all([owner, requester, second, stranger].map((u) => deleteTestUser(u.id)))
})

describe('exchange thread and toy offers', () => {
  it('X02 loads the thread with the toy, both names and the messages oldest first, for a party only', async () => {
    await call(requester, `/api/toy-transactions/${txId}/messages`, 'POST', { body: 'First hello' })
    await call(owner, `/api/toy-transactions/${txId}/messages`, 'POST', { body: 'Second reply' })

    const res = await call(owner, `/api/toy-transactions/${txId}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { id: string; toy_name: string; status: string; messages: Array<{ body: string; sender_id: string }> }
    expect(body).toMatchObject({ id: txId, toy_name: 'Thread drum', status: 'requested' })
    expect(body.messages.map((m) => [m.body, m.sender_id])).toEqual([
      ['Requested this toy for donation.', requester.id],
      ['First hello', requester.id],
      ['Second reply', owner.id],
    ])
    expect((await call(requester, `/api/toy-transactions/${txId}`)).status).toBe(200)
    expect((await call(stranger, `/api/toy-transactions/${txId}`)).status).toBe(404)
  })

  it('W12 lists every open offer on the toy for its owner, and the row goes stale once one is rejected', async () => {
    const open = async () =>
      ((await (await call(owner, '/api/toy-transactions')).json()) as Array<{ id: string; toy_id: string; status: string }>)
        .filter((t) => t.toy_id === toyId && t.status === 'requested')
        .map((t) => t.id)
        .sort()
    expect(await open()).toEqual([txId, secondTxId].sort())

    expect((await call(owner, `/api/toy-transactions/${secondTxId}/reject`, 'POST', { reason: 'Already promised' })).status).toBe(200)
    expect(await open()).toEqual([txId])
  })
})
