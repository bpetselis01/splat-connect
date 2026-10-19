/** GET /api/toy-transactions/action-count: the Exchanges badge counts what the caller is blocking. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'
import { call, ok, publishedToy } from './api.js'

const actionCount = async (who: TestUser) => (await (await call(who, 'GET', '/toy-transactions/action-count')).json()) as { count: number }

let owner: TestUser
let family: TestUser
beforeAll(async () => {
  ;[owner, family] = await Promise.all([createTestUser('contributor'), createTestUser('contributor')])
})
afterAll(async () => {
  await Promise.all([owner, family].map((u) => deleteTestUser(u.id)))
})

describe('the Exchanges badge', () => {
  it('counts:action-count rises for the owner when a family asks for the toy and falls when they answer', async () => {
    const toyId = await publishedToy(owner, 'Counted kite')
    expect(await actionCount(owner)).toEqual({ count: 0 })
    expect(await actionCount(family)).toEqual({ count: 0 })

    const tx = await ok(family, 'POST', '/toy-transactions', { toy_id: toyId, type: 'donation' })
    expect(await actionCount(owner)).toEqual({ count: 1 })
    expect(await actionCount(family)).toEqual({ count: 0 })

    await ok(owner, 'POST', `/toy-transactions/${tx.id}/reject`, { reason: 'Already promised' })
    expect(await actionCount(owner)).toEqual({ count: 0 })
  })
})
