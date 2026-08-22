import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import app from '../../../src/app.js'

let author: TestUser
let target: TestUser
let admin: TestUser
let ideaId: string

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
})

beforeAll(async () => {
  author = await createTestUser('contributor')
  target = await createTestUser('contributor')
  admin = await createTestUser('admin')
  const { data } = await adminClient().from('toy_ideas').insert({
    author_id: author.id, title: 'Switch-adapted train', summary: 'S', description: 'D',
    intended_use: 'U', primary_user: 'P', status: 'challenge',
  }).select('id').single()
  ideaId = data!.id
})

afterAll(async () => {
  await adminClient().from('toy_ideas').delete().eq('id', ideaId) // cascades toy_idea_reports
  await Promise.all([author, target, admin].map((u) => deleteTestUser(u.id)))
})

describe('GET /api/admin/reports', () => {
  let unresolvedId: string
  let resolvedId: string

  beforeAll(async () => {
    const { data } = await adminClient().from('toy_idea_reports').insert([
      { idea_id: ideaId, reported_profile_id: target.id, reported_by: author.id, reason: 'Made another participant uncomfortable' },
      {
        idea_id: ideaId, reported_profile_id: target.id, reported_by: author.id, reason: 'Earlier, already handled',
        resolved_at: new Date().toISOString(), resolved_by: admin.id, resolution_note: 'Spoke with both parties',
      },
    ]).select('id, resolved_at')
    unresolvedId = data!.find((r) => !r.resolved_at)!.id
    resolvedId = data!.find((r) => r.resolved_at)!.id
  })

  afterAll(async () => {
    await adminClient().from('toy_idea_reports').delete().in('id', [unresolvedId, resolvedId])
  })

  it('sorts unresolved reports before resolved ones and joins names and idea title', async () => {
    const res = await app.request('/api/admin/reports', authed(admin.token))
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{
      id: string; reason: string; resolved_at: string | null
      toy_ideas: { title: string }; reported_profile: { name: string | null }; reporter: { name: string | null }
    }>

    const unresolvedIndex = rows.findIndex((r) => r.id === unresolvedId)
    const resolvedIndex = rows.findIndex((r) => r.id === resolvedId)
    expect(unresolvedIndex).toBeGreaterThanOrEqual(0)
    expect(resolvedIndex).toBeGreaterThanOrEqual(0)
    expect(unresolvedIndex).toBeLessThan(resolvedIndex)

    const row = rows.find((r) => r.id === unresolvedId)!
    expect(row.reason).toBe('Made another participant uncomfortable') // admin-only text, present here
    expect(row.toy_ideas.title).toBe('Switch-adapted train')
  })

  it('403s for a non-admin', async () => {
    const res = await app.request('/api/admin/reports', authed(author.token))
    expect(res.status).toBe(403)
  })
})

describe('PATCH /api/admin/reports/:id', () => {
  let reportId: string

  beforeAll(async () => {
    const { data } = await adminClient().from('toy_idea_reports')
      .insert({ idea_id: ideaId, reported_profile_id: target.id, reported_by: author.id, reason: 'Needs a decision' })
      .select('id').single()
    reportId = data!.id
  })

  afterAll(async () => {
    await adminClient().from('toy_idea_reports').delete().eq('id', reportId)
  })

  it('resolves an unresolved report with a resolution note', async () => {
    const res = await app.request(`/api/admin/reports/${reportId}`, authed(admin.token, {
      method: 'PATCH',
      body: JSON.stringify({ resolution_note: 'Removed and warned' }),
    }))
    expect(res.status).toBe(200)
    const body = (await res.json()) as { resolved_at: string | null; resolution_note: string | null }
    expect(body.resolved_at).toBeTruthy()
    expect(body.resolution_note).toBe('Removed and warned')

    const { data } = await adminClient().from('toy_idea_reports')
      .select('resolved_at, resolved_by, resolution_note').eq('id', reportId).single()
    expect(data!.resolved_by).toBe(admin.id)
  })

  it('404s on a second resolve of the same report', async () => {
    const res = await app.request(`/api/admin/reports/${reportId}`, authed(admin.token, {
      method: 'PATCH',
      body: JSON.stringify({ resolution_note: 'Trying again' }),
    }))
    expect(res.status).toBe(404)
  })

  it('404s for an unknown report id', async () => {
    const res = await app.request(`/api/admin/reports/00000000-0000-0000-0000-000000000000`, authed(admin.token, {
      method: 'PATCH',
      body: JSON.stringify({ resolution_note: 'n/a' }),
    }))
    expect(res.status).toBe(404)
  })
})

describe('DELETE /api/admin/ideas/:id/participants/:profileId/removal', () => {
  it('reinstates a removed participant, restoring their thread access', async () => {
    await adminClient().from('toy_idea_participants').insert({ idea_id: ideaId, profile_id: target.id })
    const { data: message } = await adminClient().from('toy_idea_messages')
      .insert({ idea_id: ideaId, sender_id: author.id, kind: 'user', body: 'Welcome!' })
      .select('id').single()
    await adminClient().from('toy_idea_participants')
      .update({ removed_at: new Date().toISOString(), removed_by: admin.id })
      .eq('idea_id', ideaId).eq('profile_id', target.id)

    // While removed, RLS returns an empty thread rather than an error.
    const beforeRes = await app.request(`/api/ideas/${ideaId}/messages`, authed(target.token))
    expect(await beforeRes.json()).toEqual([])

    const res = await app.request(
      `/api/admin/ideas/${ideaId}/participants/${target.id}/removal`,
      authed(admin.token, { method: 'DELETE' }),
    )
    expect(res.status).toBe(204)

    const { data } = await adminClient().from('toy_idea_participants')
      .select('removed_at, removed_by').eq('idea_id', ideaId).eq('profile_id', target.id).single()
    expect(data).toMatchObject({ removed_at: null, removed_by: null })

    const afterRes = await app.request(`/api/ideas/${ideaId}/messages`, authed(target.token))
    const afterMessages = (await afterRes.json()) as Array<{ id: string }>
    expect(afterMessages.map((m) => m.id)).toContain(message!.id)

    await adminClient().from('toy_idea_messages').delete().eq('id', message!.id)
    await adminClient().from('toy_idea_participants').delete().eq('idea_id', ideaId).eq('profile_id', target.id)
  })

  it('404s reinstating someone who carries no removal', async () => {
    const nobody = await createTestUser('contributor')
    try {
      const res = await app.request(
        `/api/admin/ideas/${ideaId}/participants/${nobody.id}/removal`,
        authed(admin.token, { method: 'DELETE' }),
      )
      expect(res.status).toBe(404)
    } finally {
      await deleteTestUser(nobody.id)
    }
  })
})
