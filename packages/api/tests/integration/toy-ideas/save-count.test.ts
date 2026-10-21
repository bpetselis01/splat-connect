/** 105: how many accounts saved a challenge — a number, never who. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
let saver: TestUser
let second: TestUser
let ideaId: string

beforeAll(async () => {
  author = await createTestUser('contributor')
  saver = await createTestUser('contributor')
  second = await createTestUser('contributor')
  ideaId = (
    await adminClient().from('toy_ideas').insert({ author_id: author.id, title: 'T', summary: 'S', status: 'challenge' }).select('id').single()
  ).data!.id
  await adminClient().from('saves').insert({ profile_id: saver.id, entity_type: 'challenge', entity_id: ideaId })
})

afterAll(async () => {
  await adminClient().from('saves').delete().eq('entity_id', ideaId)
  await adminClient().from('toy_ideas').delete().eq('id', ideaId)
  await deleteTestUser(author.id)
  await deleteTestUser(saver.id)
  await deleteTestUser(second.id)
})

describe('105 challenge save count', () => {
  it('is a computed field on toy_ideas', async () => {
    const { data, error } = await adminClient().from('toy_ideas').select('id, save_count').eq('id', ideaId).single()
    expect(error).toBeNull()
    expect(data!.save_count).toBe(1)
  })

  it('C11 POST /api/saves moves the count on the public brief to 2, DELETE returns it to 1, and no saver is in it', async () => {
    const brief = async () => (await app.request(`/api/public/challenges/${ideaId}`)).text()
    const as = (method: string, path: string, body?: unknown) =>
      app.request(path, {
        method,
        headers: { Authorization: `Bearer ${second.token}`, 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
      })
    expect(JSON.parse(await brief()).save_count).toBe(1)

    expect((await as('POST', '/api/saves', { entity_type: 'challenge', entity_id: ideaId })).status).toBe(201)
    const text = await brief()
    expect(JSON.parse(text).save_count).toBe(2)
    expect(text).not.toContain(saver.id)
    expect(text).not.toContain(second.id)

    expect((await as('DELETE', `/api/saves/challenges/${ideaId}`)).status).toBe(204)
    expect(JSON.parse(await brief()).save_count).toBe(1)
  })
})
