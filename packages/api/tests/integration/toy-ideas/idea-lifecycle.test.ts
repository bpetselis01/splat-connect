import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import app from '../../../src/app.js'

let author: TestUser
let pendingId: string
let publishedId: string
let rejectedId: string
let graduatedId: string

beforeAll(async () => {
  author = await createTestUser('contributor')
  const base = {
    author_id: author.id, title: 'T', summary: 'S', description: 'D',
    intended_use: 'U', primary_user: 'P',
  }
  const { data } = await adminClient().from('toy_ideas')
    .insert([
      { ...base, status: 'pending' },
      // review_note left over from an earlier rejection pass — must never
      // reach an anonymous caller even though this row is now published.
      { ...base, status: 'challenge', review_note: 'Needs more detail on primary user' },
      { ...base, status: 'rejected' },
      { ...base, status: 'graduated' },
    ])
    .select('id, status')
  pendingId = data!.find((r) => r.status === 'pending')!.id
  publishedId = data!.find((r) => r.status === 'challenge')!.id
  rejectedId = data!.find((r) => r.status === 'rejected')!.id
  graduatedId = data!.find((r) => r.status === 'graduated')!.id
})

afterAll(async () => {
  await adminClient().from('toy_ideas').delete().in('id', [pendingId, publishedId, rejectedId, graduatedId])
  await deleteTestUser(author.id)
})

describe('GET /api/public/challenges', () => {
  it('lists published challenges and never pending ones', async () => {
    const res = await app.request('/api/public/challenges')
    const body = (await res.json()) as { id: string }[]
    expect(body.some((i) => i.id === publishedId)).toBe(true)
    expect(body.some((i) => i.id === pendingId)).toBe(false)
  })

  it('404s a pending idea by direct id', async () => {
    const res = await app.request(`/api/public/challenges/${pendingId}`)
    expect(res.status).toBe(404)
  })

  it('404s a rejected idea by direct id', async () => {
    const res = await app.request(`/api/public/challenges/${rejectedId}`)
    expect(res.status).toBe(404)
  })

  it('never returns the thread to an anonymous caller', async () => {
    const res = await app.request(`/api/public/challenges/${publishedId}`)
    expect(await res.json()).not.toHaveProperty('messages')
  })

  it('never returns review_note to an anonymous caller', async () => {
    const res = await app.request(`/api/public/challenges/${publishedId}`)
    expect(await res.json()).not.toHaveProperty('review_note')
  })
})

describe('GET /api/ideas/joined', () => {
  // Tests: IMPORTANT 3 — a participant is never entitled to review_note
  //        (the author's private rejection reasoning), but the old
  //        select('toy_ideas!inner(*)') returned it to anyone who joined
  // How:   joins publishedId — which carries a real review_note left over
  //        from the fixture above — as a fresh participant, and reads it back
  // Chain: this is the exact row the anon-grant migration (040) is also
  //        guarding; this test proves the app-layer column list independently
  //        of the database grant
  it('never returns review_note to a participant', async () => {
    const participant = await createTestUser('contributor')
    await adminClient().from('toy_idea_participants')
      .insert({ idea_id: publishedId, profile_id: participant.id })

    const res = await app.request('/api/ideas/joined', {
      headers: { Authorization: `Bearer ${participant.token}` },
    })
    const body = (await res.json()) as Record<string, unknown>[]
    expect(body.some((i) => i.id === publishedId)).toBe(true)
    expect(body.find((i) => i.id === publishedId)).not.toHaveProperty('review_note')

    await adminClient().from('toy_idea_participants')
      .delete().eq('idea_id', publishedId).eq('profile_id', participant.id)
    await deleteTestUser(participant.id)
  })
})

describe('PATCH /api/admin/ideas/:id/status', () => {
  it('publishes a pending idea and notifies its author', async () => {
    const admin = await createTestUser('admin')
    const res = await app.request(`/api/admin/ideas/${pendingId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'challenge' }),
    })
    expect(res.status).toBe(200)

    const { data } = await adminClient()
      .from('notifications').select('type').eq('idea_id', pendingId)
    expect(data!.map((n) => n.type)).toContain('idea_approved')
    await deleteTestUser(admin.id)
  })

  // Tests: Fix 3a — a review_note left over from an earlier decision (or
  //        sent alongside status: 'challenge' by an ill-behaved caller) must
  //        not survive a publish. 040's reasoning for leaving `authenticated`
  //        unrestricted on toy_ideas depends on a published row never
  //        carrying a note; this makes that structurally true rather than
  //        UI-enforced.
  it('nulls any pre-existing review_note when publishing', async () => {
    const author2 = await createTestUser('contributor')
    const admin = await createTestUser('admin')
    let idea2Id: string | undefined
    try {
      const { data: idea2 } = await adminClient().from('toy_ideas').insert({
        author_id: author2.id, title: 'T', summary: 'S', description: 'D',
        intended_use: 'U', primary_user: 'P', status: 'pending',
        review_note: 'Leftover note from a prior rejection pass',
      }).select('id').single()
      idea2Id = idea2!.id

      const res = await app.request(`/api/admin/ideas/${idea2Id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
        // A caller sending review_note alongside status: 'challenge' must be
        // ignored, not merely defaulted -- the point is that it cannot survive.
        body: JSON.stringify({ status: 'challenge', review_note: 'should never be stored' }),
      })
      expect(res.status).toBe(200)

      const { data } = await adminClient()
        .from('toy_ideas').select('status, review_note').eq('id', idea2Id).single()
      expect(data!.status).toBe('challenge')
      expect(data!.review_note).toBeNull()
    } finally {
      if (idea2Id) await adminClient().from('toy_ideas').delete().eq('id', idea2Id)
      await deleteTestUser(admin.id)
      await deleteTestUser(author2.id)
    }
  })

  // Tests: Fix 3b — the review PATCH is a compare-and-swap, not read-then-act.
  //        The allowed source statuses depend on the target: publishing may
  //        only claim a 'pending' row, so once the first of two concurrent
  //        publish calls commits pending -> challenge, the second's WHERE no
  //        longer matches and it 404s rather than re-applying and re-firing
  //        idea_approved.
  // How:   two concurrent PATCH ... {status: 'challenge'} on the same fresh
  //        pending idea
  it('lets exactly one of two concurrent status changes win, with no double notification', async () => {
    const author3 = await createTestUser('contributor')
    const admin = await createTestUser('admin')
    let idea3Id: string | undefined
    try {
      const { data: idea3 } = await adminClient().from('toy_ideas').insert({
        author_id: author3.id, title: 'T', summary: 'S', description: 'D',
        intended_use: 'U', primary_user: 'P', status: 'pending',
      }).select('id').single()
      idea3Id = idea3!.id

      const patch = () => app.request(`/api/admin/ideas/${idea3Id}/status`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'challenge' }),
      })
      const [resA, resB] = await Promise.all([patch(), patch()])
      const statuses = [resA.status, resB.status].sort()
      expect(statuses).toEqual([200, 404])

      const { data: notifications } = await adminClient()
        .from('notifications').select('id').eq('idea_id', idea3Id).eq('type', 'idea_approved')
      expect(notifications).toHaveLength(1) // not double-applied: exactly one notification
    } finally {
      if (idea3Id) await adminClient().from('toy_ideas').delete().eq('id', idea3Id)
      await deleteTestUser(admin.id)
      await deleteTestUser(author3.id)
    }
  })

  it('rejects a status the review flow does not allow', async () => {
    const admin = await createTestUser('admin')
    const res = await app.request(`/api/admin/ideas/${publishedId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'graduated' }),
    })
    expect(res.status).toBe(400)
    await deleteTestUser(admin.id)
  })

  // Tests: CRITICAL 2 — a published idea can be taken down. Before this, the
  //        update was scoped to status = 'pending' only, so challenge -> rejected
  //        was unreachable and a published idea could never be unpublished.
  // How:   PATCH publishedId (status: 'challenge') to 'rejected' with a note
  // Chain: safe unlike a rejected -> pending re-open would be, because this
  //        handler always writes review_note in the same call that sets the
  //        new status — no stale-note hazard
  it('unpublishes a challenge idea by moving it to rejected', async () => {
    const admin = await createTestUser('admin')
    const res = await app.request(`/api/admin/ideas/${publishedId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', review_note: 'Withdrawn after publication' }),
    })
    expect(res.status).toBe(200)

    const { data } = await adminClient()
      .from('toy_ideas').select('status, review_note').eq('id', publishedId).single()
    expect(data!.status).toBe('rejected')
    expect(data!.review_note).toBe('Withdrawn after publication')
    await deleteTestUser(admin.id)
  })

  // Tests: the review PATCH still cannot touch a graduated idea — it is not
  //        in the widened ('pending', 'challenge') scope, so the update
  //        matches no row and 404s, same as any other already-decided idea
  // How:   PATCH graduatedId to 'rejected'
  // Chain: graduation is a one-way door; this route is not the place to undo it
  it('404s an attempt to review an already graduated idea', async () => {
    const admin = await createTestUser('admin')
    const res = await app.request(`/api/admin/ideas/${graduatedId}/status`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'rejected', review_note: 'nope' }),
    })
    expect(res.status).toBe(404)
    await deleteTestUser(admin.id)
  })
})
