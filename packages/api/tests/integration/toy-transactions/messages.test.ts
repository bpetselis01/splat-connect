import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

const BASE = 'http://localhost'

function toysReq(path: string, token: string, init: RequestInit = {}) {
  const url = path === '/' ? `${BASE}/api/toys` : `${BASE}/api/toys${path}`
  return app.request(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}
function txReq(path: string, token: string, init: RequestInit = {}) {
  const url = path === '/' ? `${BASE}/api/toy-transactions` : `${BASE}/api/toy-transactions${path}`
  return app.request(url, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
  })
}

describe('POST /api/toy-transactions/:id/messages', () => {
  let owner: TestUser
  let requester: TestUser
  let stranger: TestUser
  let txId: string

  beforeAll(async () => {
    owner = await createTestUser('contributor')
    requester = await createTestUser('contributor')
    stranger = await createTestUser('contributor')

    const create = await toysReq('/', owner.token, { method: 'POST', body: JSON.stringify({ name: 'Blocks', condition: 8 }) })
    const toy = (await create.json()) as { id: string }
    await toysReq(`/${toy.id}`, owner.token, {
      method: 'PATCH',
      body: JSON.stringify({ photo_urls: ['https://example.com/c.jpg'], offer_type: 'donation' }),
    })
    await toysReq(`/${toy.id}/publish`, owner.token, { method: 'PATCH' })

    const created = await txReq('/', requester.token, {
      method: 'POST',
      body: JSON.stringify({ toy_id: toy.id, type: 'donation' }),
    })
    txId = ((await created.json()) as { id: string }).id
  })

  afterAll(async () => {
    await deleteTestUser(owner.id)
    await deleteTestUser(requester.id)
    await deleteTestUser(stranger.id)
  })

  it('lets a party post a message', async () => {
    const res = await txReq(`/${txId}/messages`, requester.token, {
      method: 'POST',
      body: JSON.stringify({ body: 'When works for you?' }),
    })
    expect(res.status).toBe(201)

    const detail = await txReq(`/${txId}`, owner.token)
    const body = (await detail.json()) as { messages: Array<{ body: string }> }
    expect(body.messages.map((m) => m.body)).toContain('When works for you?')
  })

  it('404s a stranger posting to a transaction they are not party to, never 403', async () => {
    const res = await txReq(`/${txId}/messages`, stranger.token, {
      method: 'POST',
      body: JSON.stringify({ body: 'hi' }),
    })
    expect(res.status).toBe(404)
  })

  it('400s an empty message body', async () => {
    const res = await txReq(`/${txId}/messages`, requester.token, {
      method: 'POST',
      body: JSON.stringify({ body: '   ' }),
    })
    expect(res.status).toBe(400)
  })

  it('previews the newest message on the list, whoever sent it', async () => {
    await txReq(`/${txId}/messages`, owner.token, {
      method: 'POST',
      body: JSON.stringify({ body: 'Saturday suits me.' }),
    })

    const list = await txReq('/', requester.token)
    const rows = (await list.json()) as Array<{
      id: string
      last_message: { body: string; sender_id: string; kind: string } | null
    }>
    const row = rows.find((r) => r.id === txId)
    expect(row?.last_message?.body).toBe('Saturday suits me.')
    expect(row?.last_message?.sender_id).toBe(owner.id)
    expect(row?.last_message?.kind).toBe('user')
  })
})
