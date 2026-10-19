/** 105: how many accounts saved a challenge — a number, never who. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
let saver: TestUser
let ideaId: string

beforeAll(async () => {
  author = await createTestUser('contributor')
  saver = await createTestUser('contributor')
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
})

describe('105 challenge save count', () => {
  it('is a computed field on toy_ideas', async () => {
    const { data, error } = await adminClient().from('toy_ideas').select('id, save_count').eq('id', ideaId).single()
    expect(error).toBeNull()
    expect(data!.save_count).toBe(1)
  })

  it('C11 rides on the public brief as a number, with no saver in it', async () => {
    const res = await app.request(`/api/public/challenges/${ideaId}`)
    const text = await res.text()
    expect(JSON.parse(text).save_count).toBe(1)
    expect(text).not.toContain(saver.id)
  })
})
