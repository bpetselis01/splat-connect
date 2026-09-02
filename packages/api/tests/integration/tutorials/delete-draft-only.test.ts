import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { acceptTerms, createProject } from '../../helpers/orgs.js'
import app from '../../../src/app.js'

let author: TestUser

beforeAll(async () => {
  author = await createTestUser('contributor')
  await acceptTerms(author.id, 'contributor_terms')
})

afterAll(async () => {
  await deleteTestUser(author.id)
})

const del = (id: string) =>
  app.request(`/api/tutorials/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${author.token}` },
  })

const exists = async (id: string) => {
  const { data } = await adminClient().from('tutorials').select('id').eq('id', id).maybeSingle()
  return Boolean(data)
}

describe('DELETE /api/tutorials/:id', () => {
  it('deletes a draft', async () => {
    const id = await createProject({ authorId: author.id, status: 'draft' })
    const res = await del(id)
    expect(res.status).toBe(204)
    expect(await exists(id)).toBe(false)
  })

  // RLS refuses these, and a policy matching zero rows is not a Postgres error
  // — so before this change the route answered 204 and the caller believed it.
  it.each(['pending', 'approved', 'rejected'] as const)(
    'refuses a %s tutorial with 409 and leaves it in place',
    async (status) => {
      const id = await createProject({ authorId: author.id, status })
      const res = await del(id)
      expect(res.status).toBe(409)
      expect(await res.json()).toEqual({ error: 'Only draft guides can be deleted.' })
      expect(await exists(id)).toBe(true)
      await adminClient().from('tutorials').delete().eq('id', id)
    }
  )
})
