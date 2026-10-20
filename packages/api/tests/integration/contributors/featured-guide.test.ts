import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let stranger: TestUser
let live: string
let draft: string
let theirs: string

const patch = (body: unknown) =>
  app.request('/api/contributors/me', {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${author.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const stored = async () =>
  (await adminClient().from('profiles').select('featured_tutorial_id').eq('id', author.id).single()).data!.featured_tutorial_id

beforeAll(async () => {
  ;[author, stranger] = await Promise.all([createTestUser(), createTestUser()])
  live = await createProject({ authorId: author.id, status: 'approved', title: 'Featured fixture' })
  draft = await createProject({ authorId: author.id, status: 'draft' })
  theirs = await createProject({ authorId: stranger.id, status: 'approved' })
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().in('id', [live, draft, theirs])
  await Promise.all([author, stranger].map((u) => deleteTestUser(u.id)))
})

describe('PATCH /api/contributors/me featured guide', () => {
  it('WD11 stores one of my published guides, shows it on the public profile, and clears with null', async () => {
    expect((await patch({ featured_tutorial_id: live })).status).toBe(200)
    expect(await stored()).toBe(live)
    const profile = (await (await app.request(`/api/public/contributors/${author.id}`)).json()) as { featured: { id: string; title: string } | null }
    expect(profile.featured).toMatchObject({ id: live, title: 'Featured fixture' })

    expect((await patch({ featured_tutorial_id: null })).status).toBe(200)
    expect(await stored()).toBeNull()
  })

  it('WD11 refuses a draft of mine and a published guide that is somebody else’s, and keeps the old pick', async () => {
    await patch({ featured_tutorial_id: live })
    for (const id of [draft, theirs]) {
      const res = await patch({ featured_tutorial_id: id })
      expect(res.status).toBe(400)
      expect(((await res.json()) as { error: string }).error).toBe('featured_tutorial_id must be one of your published guides')
    }
    expect(await stored()).toBe(live)
  })
})
