/**
 * 109: everyone who saved a challenge hears when the guide it became is
 * published — once, whichever route approved it, and never a contributor.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let author: TestUser
let saver: TestUser
let contributorSaver: TestUser
let admin: TestUser
let ideaId: string
let tutorialId: string

const told = async (u: TestUser) =>
  (
    await adminClient()
      .from('notifications')
      .select('id, tutorial_title')
      .eq('recipient_id', u.id)
      .eq('type', 'challenge_guide_published')
      .eq('tutorial_id', tutorialId)
  ).data ?? []
const approve = (status: string) =>
  app.request(`/api/admin/tutorials/${tutorialId}/status`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })

beforeAll(async () => {
  ;[author, saver, contributorSaver, admin] = await Promise.all([
    createTestUser('contributor'), createTestUser('contributor'), createTestUser('contributor'), createTestUser('admin'),
  ])
  const db = adminClient()
  tutorialId = (await db.from('tutorials').insert({ title: 'Bubble guide', description: 'D', difficulty: 'easy', status: 'pending' }).select('id').single()).data!.id
  ideaId = (
    await db.from('toy_ideas').insert({ author_id: author.id, title: 'T', summary: 'S', status: 'graduated', tutorial_id: tutorialId }).select('id').single()
  ).data!.id
  await db.from('tutorial_contributors').insert({ tutorial_id: tutorialId, profile_id: contributorSaver.id, role: 'collaborator' })
  await db.from('saves').insert([
    { profile_id: saver.id, entity_type: 'challenge', entity_id: ideaId },
    { profile_id: contributorSaver.id, entity_type: 'challenge', entity_id: ideaId },
  ])
})

afterAll(async () => {
  const db = adminClient()
  await db.from('saves').delete().eq('entity_id', ideaId)
  await db.from('toy_ideas').delete().eq('id', ideaId)
  await db.from('notifications').delete().eq('tutorial_id', tutorialId)
  await db.from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([author, saver, contributorSaver, admin].map((u) => deleteTestUser(u.id)))
})

describe('109 challenge guide published', () => {
  it('keeps a graduated challenge on its saver’s list', async () => {
    const res = await app.request('/api/saves/challenges', { headers: { Authorization: `Bearer ${saver.token}` } })
    expect(((await res.json()) as { id: string }[]).map((c) => c.id)).toContain(ideaId)
  })

  it('tells the saver once the guide is approved, and not the contributor who saved it', async () => {
    expect((await approve('approved')).status).toBe(200)
    expect(await told(saver)).toEqual([expect.objectContaining({ tutorial_title: 'Bubble guide' })])
    expect(await told(contributorSaver)).toEqual([])
  })

  it('does not tell them twice when the guide is approved again', async () => {
    await approve('pending')
    await approve('approved')
    expect(await told(saver)).toHaveLength(1)
  })

  it('fires on any approval, not just the admin route', async () => {
    const db = adminClient()
    await db.from('notifications').delete().eq('tutorial_id', tutorialId)
    await db.from('tutorials').update({ status: 'pending' }).eq('id', tutorialId)
    await db.from('tutorials').update({ status: 'approved' }).eq('id', tutorialId)
    expect(await told(saver)).toHaveLength(1)
  })
})
