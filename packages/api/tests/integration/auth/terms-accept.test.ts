import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { AGREEMENT_VERSIONS } from '@splat-connect/types'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let user: TestUser

const send = (method: string, path: string, body: unknown) =>
  app.request(`/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

beforeAll(async () => {
  user = await createTestUser('contributor', { terms: false })
})
afterAll(async () => {
  await deleteTestUser(user.id)
})

describe('the terms screen’s "Accept and continue"', () => {
  it('A11 WA17 records the contributor terms at the current version, saves the name, and refuses an unknown agreement', async () => {
    expect((await send('POST', '/agreements', { agreement_type: 'nonsense' })).status).toBe(400)
    expect((await adminClient().from('user_agreements').select('id').eq('user_id', user.id)).data).toEqual([])

    expect((await send('PATCH', '/contributors/me', { name: 'Terms Taker' })).status).toBe(200)
    const res = await send('POST', '/agreements', { agreement_type: 'contributor_terms' })
    expect(res.status).toBe(201)

    expect((await adminClient().from('user_agreements').select('agreement_type, version').eq('user_id', user.id)).data)
      .toEqual([{ agreement_type: 'contributor_terms', version: AGREEMENT_VERSIONS.contributor_terms }])
    expect((await adminClient().from('profiles').select('name').eq('id', user.id).single()).data).toEqual({ name: 'Terms Taker' })
    const mine = (await (await app.request('/api/agreements/me', { headers: { Authorization: `Bearer ${user.token}` } })).json()) as { agreement_type: string }[]
    expect(mine.map((a) => a.agreement_type)).toEqual(['contributor_terms'])
  })
})
