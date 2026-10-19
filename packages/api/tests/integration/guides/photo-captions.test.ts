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
const row = async () => (await adminClient().from('tutorials').select('photo_urls, photo_captions').eq('id', guide).single()).data!

beforeAll(async () => {
  author = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'draft', title: 'Captions Fixture' })
  await adminClient().from('tutorials').update({ photo_urls: ['a', 'b', 'c'] }).eq('id', guide)
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', guide)
  await deleteTestUser(author.id)
})

describe('087 photo captions', () => {
  it('T13 WT23 saves captions beside the photos', async () => {
    expect((await patch({ photo_captions: ['The finished drum', null, 'The jack'] })).status).toBe(200)
    expect((await row()).photo_captions).toEqual(['The finished drum', null, 'The jack'])
  })

  // Review Focus 2: web reorders and removes with photo_urls alone.
  it('carries each caption with its photo when only the photos are sent', async () => {
    expect((await patch({ photo_urls: ['c', 'a'] })).status).toBe(200)
    expect(await row()).toEqual({ photo_urls: ['c', 'a'], photo_captions: ['The jack', 'The finished drum'] })
  })

  it('refuses more captions than photos, or a long one', async () => {
    const more = await patch({ photo_captions: ['1', '2', '3'] })
    expect(more.status).toBe(400)
    expect(((await more.json()) as { error: string }).error).toBe('There are more captions than photos.')
    expect((await patch({ photo_captions: ['x'.repeat(61)] })).status).toBe(400)
  })

  it('is backed by a check in the database', async () => {
    const { error } = await adminClient().from('tutorials').update({ photo_captions: ['1', '2', '3'] }).eq('id', guide)
    expect(error?.code).toBe('23514')
  })
})
