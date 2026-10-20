import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let guide: string
const auth = () => ({ Authorization: `Bearer ${author.token}`, 'Content-Type': 'application/json' })
const postParts = (parts: unknown) =>
  app.request(`/api/tutorials/${guide}/parts`, { method: 'POST', headers: auth(), body: JSON.stringify({ parts }) })
const patch = async (fields: Record<string, unknown>) => {
  const { data } = await adminClient().from('tutorials').select('updated_at').eq('id', guide).single()
  return app.request(`/api/tutorials/${guide}`, { method: 'PATCH', headers: auth(), body: JSON.stringify({ ...fields, updated_at: data!.updated_at }) })
}

beforeAll(async () => {
  author = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'draft', title: 'Part Prices Fixture' })
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', guide)
  await deleteTestUser(author.id)
})

describe('086 part prices', () => {
  it('has both columns', async () => {
    expect((await adminClient().from('parts').select('price_cents').limit(1)).error).toBeNull()
    expect((await adminClient().from('tutorials').select('prices_checked_on').limit(1)).error).toBeNull()
  })

  it('T09 WT25 saves a line price in cents, and no price as null', async () => {
    const res = await postParts([
      { name: 'Relay module', quantity: 1, is_optional: false, buy_links: [], price_cents: 600 },
      { name: 'Big button', quantity: 1, is_optional: false, buy_links: [] },
    ])
    expect(res.status).toBe(201)
    const { data } = await adminClient().from('parts').select('name, price_cents').eq('tutorial_id', guide).order('name')
    expect(data).toEqual([{ name: 'Big button', price_cents: null }, { name: 'Relay module', price_cents: 600 }])
  })

  it('refuses a negative or fractional price', async () => {
    const neg = await postParts([{ name: 'X', quantity: 1, is_optional: false, buy_links: [], price_cents: -1 }])
    expect(neg.status).toBe(400)
    expect(((await neg.json()) as { error: string }).error).toBe("Part 1's price must be a whole number of cents, 0 or more")
    expect((await postParts([{ name: 'X', quantity: 1, is_optional: false, buy_links: [], price_cents: 1.5 }])).status).toBe(400)
  })

  it('takes a prices-checked date through PATCH and refuses anything else', async () => {
    expect((await patch({ prices_checked_on: '2026-08-02' })).status).toBe(200)
    const bad = await patch({ prices_checked_on: 'last week' })
    expect(bad.status).toBe(400)
    expect(((await bad.json()) as { error: string }).error).toBe('Prices checked must be a date')
  })
})
