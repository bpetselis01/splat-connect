/**
 * The numbers on a challenge card: makers who joined, answers from anyone but
 * the asker, and how many accounts saved it. Read from the public brief, the
 * anonymous page, after the route that moves each one.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { call, ok } from './api.js'

type Brief = { maker_count: number; answer_count: number; save_count: number }
let admin: TestUser
let author: TestUser
let makerA: TestUser
let makerB: TestUser
let ideaId: string

const brief = async () => (await (await app.request(`/api/public/challenges/${ideaId}`)).json()) as Brief

beforeAll(async () => {
  ;[admin, author, makerA, makerB] = await Promise.all([
    createTestUser('admin'), createTestUser('contributor'), createTestUser('contributor'), createTestUser('contributor'),
  ])
  ideaId = (await ok(author, 'POST', '/ideas', { title: 'A counted switch', summary: 'Easier to press' })).id
  await ok(admin, 'PATCH', `/admin/ideas/${ideaId}/status`, { status: 'challenge' })
})
afterAll(async () => {
  await adminClient().from('saves').delete().eq('entity_id', ideaId)
  await adminClient().from('toy_ideas').delete().eq('id', ideaId)
  await Promise.all([admin, author, makerA, makerB].map((u) => deleteTestUser(u.id)))
})

describe('a challenge card', () => {
  it('counts:challenge.maker_count rises with each maker who joins and falls when one leaves', async () => {
    expect(await brief()).toMatchObject({ maker_count: 0 })
    await ok(makerA, 'POST', `/ideas/${ideaId}/join`, {})
    expect(await brief()).toMatchObject({ maker_count: 1 })
    await ok(makerB, 'POST', `/ideas/${ideaId}/join`, {})
    expect(await brief()).toMatchObject({ maker_count: 2 })

    await ok(makerB, 'DELETE', `/ideas/${ideaId}/participants/${makerB.id}`)
    expect(await brief()).toMatchObject({ maker_count: 1 })
  })

  it("counts:challenge.answer_count rises with a maker's reply and never with the asker's own", async () => {
    expect(await brief()).toMatchObject({ answer_count: 0 })
    await ok(makerA, 'POST', `/ideas/${ideaId}/messages`, { body: 'Try a wider button.' })
    expect(await brief()).toMatchObject({ answer_count: 1 })

    await ok(author, 'POST', `/ideas/${ideaId}/messages`, { body: 'Thanks, how wide?' })
    expect(await brief()).toMatchObject({ answer_count: 1 })
  })

  it('counts:saves.save_count rises when a member saves the challenge and falls when they unsave it', async () => {
    expect(await brief()).toMatchObject({ save_count: 0 })
    expect((await call(makerA, 'POST', '/saves', { entity_type: 'challenge', entity_id: ideaId })).status).toBe(201)
    expect(await brief()).toMatchObject({ save_count: 1 })

    expect((await call(makerA, 'DELETE', `/saves/challenges/${ideaId}`)).status).toBe(204)
    expect(await brief()).toMatchObject({ save_count: 0 })
  })
})
