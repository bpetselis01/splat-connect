import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let guide: string
const post = (tools: unknown) =>
  app.request(`/api/tutorials/${guide}/tools`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${author.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ tools }),
  })

beforeAll(async () => {
  author = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'draft', title: 'Tool Notes Fixture' })
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', guide)
  await deleteTestUser(author.id)
})

describe('085 tool notes', () => {
  it('has both columns', async () => {
    const { error } = await adminClient().from('tools').select('note, get_by').limit(1)
    expect(error).toBeNull()
  })

  it('T25 WT26 replaces the whole tool list with the posted rows: name, optional, note, get-by', async () => {
    await post([{ name: 'Old tool', is_optional: false, buy_links: [] }])
    const res = await post([
      { name: 'Hot glue gun', is_optional: true, buy_links: [], note: 'Low-temp is fine', get_by: 'buy' },
      { name: 'Pliers', is_optional: false, buy_links: [], note: null, get_by: null },
    ])
    expect(res.status).toBe(201)
    const { data } = await adminClient().from('tools').select('name, is_optional, note, get_by').eq('tutorial_id', guide).order('name')
    expect(data).toEqual([
      { name: 'Hot glue gun', is_optional: true, note: 'Low-temp is fine', get_by: 'buy' },
      { name: 'Pliers', is_optional: false, note: null, get_by: null },
    ])
  })

  it('saves a note and how to get the tool', async () => {
    const res = await post([{ name: 'Soldering iron', is_optional: false, buy_links: [], note: 'Borrow from a library or makerspace', get_by: 'borrow' }])
    expect(res.status).toBe(201)
    const { data } = await adminClient().from('tools').select('note, get_by').eq('tutorial_id', guide)
    expect(data).toEqual([{ note: 'Borrow from a library or makerspace', get_by: 'borrow' }])
  })

  it('refuses a long note or an unknown way to get it, and leaves the list alone', async () => {
    const long = await post([{ name: 'Iron', is_optional: false, buy_links: [], note: 'x'.repeat(201) }])
    expect(long.status).toBe(400)
    expect(((await long.json()) as { error: string }).error).toBe("Tool 1's note is over 200 characters")
    expect((await post([{ name: 'Iron', is_optional: false, buy_links: [], get_by: 'steal' }])).status).toBe(400)
    const { count } = await adminClient().from('tools').select('id', { count: 'exact', head: true }).eq('tutorial_id', guide)
    expect(count).toBe(1)
  })
})
