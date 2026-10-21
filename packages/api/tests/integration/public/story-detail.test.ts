/**
 * GET /api/public/stories/:id — the reading page's data: the organisation
 * behind the byline, the linked guide only while it is approved, and the other
 * published stories. A draft is not found.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
let orgId: string
let guideId: string
let withdrawnId: string
let storyId: string
let otherId: string
let draftId: string

const detail = async (id: string) => app.request(`/api/public/stories/${id}`)
const row = (over: Record<string, unknown>) => ({
  org_id: orgId,
  kind: 'family',
  summary: 'One sentence.',
  body: 'A paragraph.',
  byline: 'A leader',
  consent_confirmed: true,
  status: 'published',
  published_at: new Date().toISOString(),
  created_by: author.id,
  ...over,
})

beforeAll(async () => {
  const admin = adminClient()
  author = await createTestUser('contributor')
  const { data: org } = await admin
    .from('organizations')
    .insert({ name: `Story Detail Org ${Date.now()}`, status: 'active' })
    .select('id')
    .single()
  orgId = org!.id
  const guide = async (title: string, status: string) =>
    (await admin.from('tutorials').insert({ title, difficulty: 'easy', status }).select('id').single()).data!.id as string
  guideId = await guide('Story detail guide', 'approved')
  withdrawnId = await guide('Story detail withdrawn guide', 'rejected')
  const ins = async (over: Record<string, unknown>) =>
    (await admin.from('org_stories').insert(row(over)).select('id').single()).data!.id as string
  storyId = await ins({ title: 'Detail story', link_tutorial_id: guideId, pull_quote: 'Loud and lovely', pull_quote_by: 'Mia' })
  otherId = await ins({ title: 'Detail other story' })
  draftId = await ins({ title: 'Detail draft', status: 'draft', published_at: null })
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('org_stories').delete().eq('org_id', orgId)
  await admin.from('tutorials').delete().in('id', [guideId, withdrawnId])
  await admin.from('organizations').delete().eq('id', orgId)
  await deleteTestUser(author.id)
})

describe('GET /api/public/stories/:id', () => {
  it('WS10 returns the story with its organisation, its approved guide and the other published stories', async () => {
    const res = await detail(storyId)
    expect(res.status).toBe(200)
    const body = (await res.json()) as Record<string, any>
    expect(body).toMatchObject({
      id: storyId,
      title: 'Detail story',
      pull_quote: 'Loud and lovely',
      org: { id: orgId },
      org_name: expect.stringMatching(/^Story Detail Org/),
      link_tutorial: { id: guideId, title: 'Story detail guide' },
      read_minutes: 1,
    })
    const more = (body.more as Array<{ id: string }>).map((m) => m.id)
    expect(more).toContain(otherId)
    expect(more).not.toContain(storyId)
    expect(more).not.toContain(draftId)
  })

  it('WS10 drops the linked guide once it is no longer approved', async () => {
    await adminClient().from('org_stories').update({ link_tutorial_id: withdrawnId }).eq('id', storyId)
    const body = (await (await detail(storyId)).json()) as { link_tutorial: unknown }
    expect(body.link_tutorial).toBeNull()
  })

  it('WS10 404s a draft and an id that is not a uuid', async () => {
    expect((await detail(draftId)).status).toBe(404)
    expect((await detail('not-a-uuid')).status).toBe(404)
  })
})
