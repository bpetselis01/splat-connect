/**
 * 103: an idea needs a title and a summary, nothing else. Old ideas keep their
 * intended use and primary user; new ones may leave every other field out.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
const ids: string[] = []

beforeAll(async () => {
  author = await createTestUser('contributor')
})

afterAll(async () => {
  await adminClient().from('toy_ideas').delete().in('id', ids)
  await deleteTestUser(author.id)
})

const post = (body: unknown) =>
  app.request('/api/ideas', {
    method: 'POST',
    headers: { Authorization: `Bearer ${author.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

describe('103 idea optional fields', () => {
  it('lets the database hold an idea with only a title and a summary', async () => {
    const { data, error } = await adminClient()
      .from('toy_ideas')
      .insert({ author_id: author.id, title: 'T', summary: 'S', status: 'pending' })
      .select('id, description, intended_use, primary_user')
      .single()
    expect(error).toBeNull()
    ids.push(data!.id)
    expect(data).toMatchObject({ description: null, intended_use: null, primary_user: null })
  })

  it('C12 takes an idea with only a title and a summary, and stores a blank why-it-matters as nothing', async () => {
    const res = await post({ title: '  Bubble machine  ', summary: 'One switch.', description: '   ' })
    expect(res.status).toBe(201)
    const row = (await res.json()) as { id: string; title: string; description: string | null }
    ids.push(row.id)
    expect(row).toMatchObject({ title: 'Bubble machine', description: null })
  })

  it('still refuses an idea with no summary, in a sentence', async () => {
    const res = await post({ title: 'T' })
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toBe('A title and a summary are required.')
  })
})
