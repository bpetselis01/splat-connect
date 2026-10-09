/**
 * No toy-transactions response carries a child_label key, even for a legacy
 * row that still holds one. Delete this file with the migration that drops the
 * column (it seeds the column through the admin client).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let maker: TestUser
let tutorialId: string
let txId: string

const get = (u: TestUser, path: string) =>
  app.request(`/api/toy-transactions${path}`, { headers: { Authorization: `Bearer ${u.token}` } })

beforeAll(async () => {
  ;[family, maker] = await Promise.all([createTestUser('contributor'), createTestUser('contributor')])
  const db = adminClient()
  const t = await db.from('tutorials').insert({ title: `NoLabel ${Date.now()}`, description: 'G', difficulty: 'easy', status: 'approved' }).select('id').single()
  if (t.error) throw t.error
  tutorialId = t.data.id
  const tx = await db.from('toy_transactions').insert({
    type: 'build', status: 'accepted', tutorial_id: tutorialId, requester_id: family.id, owner_id: maker.id,
    owner_code: '111111', requester_code: '222222', child_label: 'Leo, 3',
  }).select('id').single()
  if (tx.error) throw tx.error
  txId = tx.data.id
})

afterAll(async () => {
  await adminClient().from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([family, maker].map((u) => deleteTestUser(u.id)))
})

describe('child_label is never in a response', () => {
  it.each([['the family', () => family], ['the maker', () => maker]])('detail for %s', async (_n, who) => {
    const res = await get(who(), `/${txId}`)
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).toContain(txId)
    expect(text).not.toContain('child_label')
    expect(text).not.toContain('Leo, 3')
  })

  it('the list', async () => {
    const text = await (await get(family, '')).text()
    expect(text).toContain(txId)
    expect(text).not.toContain('child_label')
  })
})
