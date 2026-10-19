// journeys: S02
/**
 * GET /api/contributors/me/thanks lists the thanks you were given, newest
 * first, with the hidden flag so the owner can hide or unhide a note. It is
 * scoped to the caller: someone else's thanks never appear.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let maker: TestUser
let bystander: TestUser
let alice: TestUser
let bob: TestUser

const mine = (token: string) => app.request('/api/contributors/me/thanks', { headers: { Authorization: `Bearer ${token}` } })

beforeAll(async () => {
  ;[maker, bystander, alice, bob] = await Promise.all([createTestUser(), createTestUser(), createTestUser(), createTestUser()])
  const { error } = await adminClient()
    .from('profile_thanks')
    .insert([
      { profile_id: maker.id, thanker_id: alice.id, note: 'Older note', byline: 'Alice', show_note: true, created_at: '2020-01-01T00:00:00Z' },
      { profile_id: maker.id, thanker_id: bob.id, note: 'Hidden note', byline: 'Bob', show_note: false, hidden_at: '2020-02-02T00:00:00Z', created_at: '2020-02-01T00:00:00Z' },
      { profile_id: bystander.id, thanker_id: alice.id, note: 'Not yours', byline: null, show_note: false, created_at: '2020-03-01T00:00:00Z' },
    ])
  if (error) throw new Error(error.message)
})

afterAll(async () => {
  await adminClient().from('profile_thanks').delete().in('profile_id', [maker.id, bystander.id])
  await Promise.all([maker, bystander, alice, bob].map((u) => deleteTestUser(u.id)))
})

describe('GET /api/contributors/me/thanks', () => {
  it('lists the thanks given to the caller, newest first, with the hidden flag', async () => {
    const res = await mine(maker.token)
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ thanker_id: string; note: string; byline: string; show_note: boolean; hidden_at: string | null }>
    expect(rows.map((r) => [r.note, r.byline, r.show_note, r.hidden_at !== null])).toEqual([
      ['Hidden note', 'Bob', false, true],
      ['Older note', 'Alice', true, false],
    ])
    expect(rows.map((r) => r.thanker_id)).toEqual([bob.id, alice.id])
  })

  it('does not show another member the thanks that belong to the maker', async () => {
    const rows = (await (await mine(bystander.token)).json()) as Array<{ note: string }>
    expect(rows.map((r) => r.note)).toEqual(['Not yours'])
  })

  it('is an empty list for a member nobody has thanked', async () => {
    const res = await mine(alice.token)
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual([])
  })

  it('is 401 with no session', async () => {
    expect((await app.request('/api/contributors/me/thanks')).status).toBe(401)
  })
})
