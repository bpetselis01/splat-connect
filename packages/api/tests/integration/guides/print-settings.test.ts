import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let guide: string
const patch = async (fields: Record<string, unknown>) => {
  const { data } = await adminClient().from('tutorials').select('updated_at').eq('id', guide).single()
  return app.request(`/api/tutorials/${guide}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${author.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...fields, updated_at: data!.updated_at }),
  })
}

beforeAll(async () => {
  author = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'draft', title: 'Print Settings Fixture' })
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', guide)
  await deleteTestUser(author.id)
})

describe('088 print settings', () => {
  it('saves all four', async () => {
    expect((await patch({ layer_height_mm: 0.2, infill_percent: 25, material: 'PETG', print_minutes: 190 })).status).toBe(200)
    const { data } = await adminClient().from('tutorials').select('layer_height_mm, infill_percent, material, print_minutes').eq('id', guide).single()
    expect(data).toEqual({ layer_height_mm: 0.2, infill_percent: 25, material: 'PETG', print_minutes: 190 })
  })

  it('stores a 40-character material with a trailing space, trimmed', async () => {
    expect((await patch({ material: 'x'.repeat(40) + ' ' })).status).toBe(200)
    const { data } = await adminClient().from('tutorials').select('material').eq('id', guide).single()
    expect(data?.material).toBe('x'.repeat(40))
  })

  it('refuses each out of range with a sentence', async () => {
    const cases: [Record<string, unknown>, string][] = [
      [{ layer_height_mm: 2 }, 'Layer height must be between 0.05 and 1 mm'],
      [{ infill_percent: 101 }, 'Infill must be a whole percent from 0 to 100'],
      [{ material: 'x'.repeat(41) }, 'Material is over 40 characters'],
      [{ print_minutes: 0 }, 'Print time must be 1 to 6000 minutes'],
    ]
    for (const [fields, message] of cases) {
      const res = await patch(fields)
      expect(res.status).toBe(400)
      expect(((await res.json()) as { error: string }).error).toBe(message)
    }
  })
})
