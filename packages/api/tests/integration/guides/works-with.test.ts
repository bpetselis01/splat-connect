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
  guide = await createProject({ authorId: author.id, status: 'draft', title: 'Works With Fixture' })
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', guide)
  await deleteTestUser(author.id)
})

describe('089 works with', () => {
  it('saves the starting toy, what it works with and the no-build note', async () => {
    const fields = {
      toy_name: 'Plush barking dog',
      toy_brand: 'ZURU',
      works_with: 'Any 3.5mm switch — Jelly Bean, Big Red, or a printed lever switch.',
      no_build_note: 'Two adapted copies of this toy are in the library right now.',
    }
    expect((await patch(fields)).status).toBe(200)
    const { data } = await adminClient().from('tutorials').select('toy_name, toy_brand, works_with, no_build_note').eq('id', guide).single()
    expect(data).toEqual(fields)
  })

  it('refuses each over its limit', async () => {
    for (const [field, max, label] of [['toy_name', 80, 'The toy’s name'], ['toy_brand', 80, 'The toy’s maker'], ['works_with', 300, 'Works with'], ['no_build_note', 300, 'The note for people who would rather not build']] as const) {
      const res = await patch({ [field]: 'x'.repeat(max + 1) })
      expect(res.status).toBe(400)
      expect(((await res.json()) as { error: string }).error).toBe(`${label} is over ${max} characters`)
    }
  })
})
