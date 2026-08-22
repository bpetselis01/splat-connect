import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import app from '../../../src/app.js'

let author: TestUser
let joiner: TestUser
let removedJoiner: TestUser
let admin: TestUser
let ideaId: string
let tutorialId: string | null = null

beforeAll(async () => {
  author = await createTestUser('contributor')
  joiner = await createTestUser('contributor')
  removedJoiner = await createTestUser('contributor')
  admin = await createTestUser('admin')
  const { data } = await adminClient().from('toy_ideas').insert({
    author_id: author.id, title: 'Weighted spoon', summary: 'S', description: 'D',
    intended_use: 'U', primary_user: 'P', status: 'challenge',
  }).select('id').single()
  ideaId = data!.id
  await adminClient().from('toy_idea_participants').insert({ idea_id: ideaId, profile_id: joiner.id })
  // Removed before graduation runs — Fix 2 pins that this row must not end up
  // credited as a tutorial_contributors 'collaborator'.
  await adminClient().from('toy_idea_participants').insert({
    idea_id: ideaId, profile_id: removedJoiner.id,
    removed_at: new Date().toISOString(), removed_by: author.id,
  })
})

afterAll(async () => {
  if (tutorialId) await adminClient().from('tutorials').delete().eq('id', tutorialId)
  // toy_idea_participants and notifications both FK idea_id -> toy_ideas
  // on delete cascade (042, 039), so this alone clears them too.
  await adminClient().from('toy_ideas').delete().eq('id', ideaId)
  await Promise.all([author, joiner, removedJoiner, admin].map((u) => deleteTestUser(u.id)))
})

function asAdmin() {
  return { method: 'POST', headers: { Authorization: `Bearer ${admin.token}` } }
}

describe('POST /api/admin/ideas/:id/graduate', () => {
  it('creates a draft tutorial with the author primary and joiners as collaborators', async () => {
    const res = await app.request(`/api/admin/ideas/${ideaId}/graduate`, asAdmin())
    expect(res.status).toBe(201)
    tutorialId = ((await res.json()) as { tutorial_id: string }).tutorial_id

    const { data: tutorial } = await adminClient()
      .from('tutorials').select('status, difficulty').eq('id', tutorialId).single()
    expect(tutorial!.status).toBe('draft')
    expect(tutorial!.difficulty).toBe('medium')

    const { data: contributors } = await adminClient()
      .from('tutorial_contributors').select('profile_id, role').eq('tutorial_id', tutorialId)
    expect(contributors).toEqual(
      expect.arrayContaining([
        { profile_id: author.id, role: 'primary' },
        { profile_id: joiner.id, role: 'collaborator' },
      ])
    )

    const { data: idea } = await adminClient()
      .from('toy_ideas').select('status, tutorial_id').eq('id', ideaId).single()
    expect(idea).toMatchObject({ status: 'graduated', tutorial_id: tutorialId })
  })

  it('refuses to graduate the same challenge twice', async () => {
    const res = await app.request(`/api/admin/ideas/${ideaId}/graduate`, asAdmin())
    expect(res.status).toBe(409)
  })

  // Pins the retry-safety property behind the chosen write order: the idea
  // status flip runs before the contributor insert, so the one reachable
  // partial state is "graduated, tutorial exists, no contributors" — never a
  // second tutorial. Constructed directly rather than by forcing the endpoint
  // to fail mid-sequence, since the point is the retry-safety guarantee, not
  // the failure path that produces this state.
  //
  // Cleanup runs in `finally`: a failed assertion above must not leak these
  // rows into the shared integration DB (fileParallelism: false) and break a
  // sibling suite.
  it('409s a retry rather than duplicating the tutorial, even with no contributor rows written', async () => {
    const author2 = await createTestUser('contributor')
    let idea2Id: string | undefined
    let tutorial2Id: string | undefined
    try {
      const { data: idea2 } = await adminClient().from('toy_ideas').insert({
        author_id: author2.id, title: 'One-handed jar opener', summary: 'S', description: 'D',
        intended_use: 'U', primary_user: 'P', status: 'challenge',
      }).select('id').single()
      idea2Id = idea2!.id
      const { data: tutorial2 } = await adminClient().from('tutorials').insert({
        title: 'One-handed jar opener', description: 'S', status: 'draft', difficulty: 'medium',
      }).select('id').single()
      tutorial2Id = tutorial2!.id
      // The reachable partial state: status flip succeeded, contributor insert never ran.
      await adminClient().from('toy_ideas')
        .update({ status: 'graduated', tutorial_id: tutorial2Id })
        .eq('id', idea2Id)

      const before = await adminClient().from('tutorials').select('id', { count: 'exact', head: true })
      const res = await app.request(`/api/admin/ideas/${idea2Id}/graduate`, asAdmin())
      expect(res.status).toBe(409)
      const after = await adminClient().from('tutorials').select('id', { count: 'exact', head: true })
      expect(after.count).toBe(before.count) // no second tutorial minted by the retry

      const { data: contributors } = await adminClient()
        .from('tutorial_contributors').select('profile_id').eq('tutorial_id', tutorial2Id)
      expect(contributors).toEqual([]) // still the inert, repairable gap — untouched by the retry
    } finally {
      if (tutorial2Id) await adminClient().from('tutorials').delete().eq('id', tutorial2Id)
      if (idea2Id) await adminClient().from('toy_ideas').delete().eq('id', idea2Id)
      await deleteTestUser(author2.id)
    }
  })

  // Pins the concurrency property the compare-and-swap claim exists for: two
  // simultaneous calls on the same idea must not both succeed. A read-then-act
  // guard would let both pass, both mint a tutorial, and both attach a full
  // contributor set — an orphan reachable through the normal pending->approved
  // review path. The `.eq('status', 'challenge')` on the claim update makes
  // exactly one of these win; the loser's update matches zero rows.
  it('lets exactly one of two concurrent graduate calls win, with no duplicate tutorial', async () => {
    const author3 = await createTestUser('contributor')
    let idea3Id: string | undefined
    let wonTutorialId: string | undefined
    try {
      const { data: idea3 } = await adminClient().from('toy_ideas').insert({
        author_id: author3.id, title: 'Adaptive crayon grip', summary: 'S', description: 'D',
        intended_use: 'U', primary_user: 'P', status: 'challenge',
      }).select('id').single()
      idea3Id = idea3!.id

      const before = await adminClient().from('tutorials').select('id', { count: 'exact', head: true })

      const [resA, resB] = await Promise.all([
        app.request(`/api/admin/ideas/${idea3Id}/graduate`, asAdmin()),
        app.request(`/api/admin/ideas/${idea3Id}/graduate`, asAdmin()),
      ])
      const statuses = [resA.status, resB.status].sort()
      expect(statuses).toEqual([201, 409])

      const winner = resA.status === 201 ? resA : resB
      wonTutorialId = ((await winner.json()) as { tutorial_id: string }).tutorial_id

      const after = await adminClient().from('tutorials').select('id', { count: 'exact', head: true })
      expect(after.count).toBe((before.count ?? 0) + 1) // exactly one tutorial minted, not two

      const { data: idea3After } = await adminClient()
        .from('toy_ideas').select('tutorial_id').eq('id', idea3Id).single()
      expect(idea3After!.tutorial_id).toBe(wonTutorialId)
    } finally {
      if (wonTutorialId) await adminClient().from('tutorials').delete().eq('id', wonTutorialId)
      if (idea3Id) await adminClient().from('toy_ideas').delete().eq('id', idea3Id)
      await deleteTestUser(author3.id)
    }
  })

  // Tests: Fix 2 — a participant removed before graduation (e.g. after a
  //        report) must not be credited as a tutorial_contributors
  //        'collaborator' on the resulting guide, since that table is also
  //        the access gate for the draft: crediting them would hand back
  //        exactly the access their removal took away.
  // How:   idea already graduated by the first test above (ideaId), with
  //        removedJoiner removed before graduation ran.
  it('excludes a removed participant from tutorial contributor credit', async () => {
    const { data: contributors } = await adminClient()
      .from('tutorial_contributors').select('profile_id').eq('tutorial_id', tutorialId)
    expect((contributors ?? []).map((r) => r.profile_id)).not.toContain(removedJoiner.id)
  })

  // Tests: Fix 1 — graduation notifies the author and every current
  //        participant with idea_graduated, using the same removed_at is
  //        null filter as Fix 2 so a removed participant is not notified
  //        about the guide they were excluded from either.
  it('notifies the author and current participants with idea_graduated, excluding a removed participant', async () => {
    const { data: notifications } = await adminClient()
      .from('notifications')
      .select('recipient_id, type, idea_id')
      .eq('idea_id', ideaId)
      .eq('type', 'idea_graduated')
    const recipients = (notifications ?? []).map((n) => n.recipient_id)
    expect(recipients).toContain(author.id)
    expect(recipients).toContain(joiner.id)
    expect(recipients).not.toContain(removedJoiner.id)
  })
})
