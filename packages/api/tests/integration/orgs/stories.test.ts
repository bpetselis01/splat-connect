/**
 * Stories, and the two things that keep a public reading page honest.
 *
 * - **Consent is a constraint, not a checkbox.** A published story about a
 *   named child is publishable only because somebody took responsibility for
 *   it. 059 refuses the row; the route refuses it in a sentence; both are
 *   checked, because either alone can be bypassed by the other's caller.
 * - **An announcement speaks for SPLAT.** 062 made org_id nullable so the
 *   "From SPLAT" filter can match something, and an org-less story that any
 *   leader could write would let a therapy service publish in the platform's
 *   voice. Admin-only, at the policy and at the route.
 *
 * Plus the ordinary boundary: a draft is never on the public list, and
 * published_at is stamped on the way out rather than copied from created_at.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let leader: TestUser
let orgId: string
let draftId: string
let publishedId: string

const authed = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })
const json = (token: string, method: string, body: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

const story = (over: Record<string, unknown> = {}) => ({
  kind: 'family',
  title: `Integration story ${Date.now()}`,
  summary: 'One sentence.',
  body: 'A paragraph.\n\nAnd another.',
  byline: 'A leader',
  consent_confirmed: true,
  ...over,
})

beforeAll(async () => {
  leader = await createTestUser('contributor')
  const admin = adminClient()
  const { data: org } = await admin
    .from('organizations')
    .insert({ name: `Stories Org ${Date.now()}`, status: 'active' })
    .select('id')
    .single()
  orgId = org!.id
  await admin.from('org_leaders').insert({ org_id: orgId, user_id: leader.id })
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('org_stories').delete().eq('org_id', orgId)
  await admin.from('org_leaders').delete().eq('org_id', orgId)
  await admin.from('organizations').delete().eq('id', orgId)
  await deleteTestUser(leader.id)
})

describe('publishing a story', () => {
  it('refuses to publish without consent', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/stories`,
      json(leader.token, 'POST', story({ consent_confirmed: false, status: 'published' }))
    )
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toMatch(/consent/i)
  })

  it('saves a draft with no consent, because a draft is not published', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/stories`,
      json(leader.token, 'POST', story({ consent_confirmed: false }))
    )
    expect(res.status).toBe(201)
    const row = (await res.json()) as { id: string; published_at: string | null }
    draftId = row.id
    expect(row.published_at).toBeNull()
  })

  it('stamps published_at on the way out, not from created_at', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/stories`,
      json(leader.token, 'POST', story({ status: 'published' }))
    )
    expect(res.status).toBe(201)
    const row = (await res.json()) as { id: string; published_at: string | null; created_at: string }
    publishedId = row.id
    expect(row.published_at).not.toBeNull()
  })

  // Chain: 062 refuses this with a check constraint, for the reason recorded
  //        there — an unattributed quote reads as the platform's voice put in a
  //        family's mouth.
  it('refuses a pull quote with nobody attached to it', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/stories`,
      json(leader.token, 'POST', story({ pull_quote: 'He looked at us.', pull_quote_by: '' }))
    )
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toMatch(/who/i)
  })

  // Chain: an org-less story is a platform announcement. A leader who could
  //        write one would be publishing in SPLAT's voice.
  it('refuses a leader writing an announcement', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/stories`,
      json(leader.token, 'POST', story({ kind: 'announcement' }))
    )
    expect(res.status).toBe(400)
    expect(((await res.json()) as { error: string }).error).toMatch(/SPLAT/i)
  })
})

describe('the public list', () => {
  it('shows the published one and never the draft', async () => {
    const res = await app.request('/api/public/stories')
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ id: string; read_minutes: number }>
    const ids = rows.map((r) => r.id)
    expect(ids).toContain(publishedId)
    expect(ids).not.toContain(draftId)
    // Computed from the body, never stored — and never zero.
    expect(rows.find((r) => r.id === publishedId)!.read_minutes).toBeGreaterThanOrEqual(1)
  })

  it('404s a draft by id, even to the leader who wrote it', async () => {
    // The public route reads through the anon client whatever session the
    // caller has: a leader reads their own drafts through the authenticated
    // organisation route instead.
    const res = await app.request(`/api/public/stories/${draftId}`, authed(leader.token))
    expect(res.status).toBe(404)
  })

  it('clears published_at when a story is unpublished', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/stories/${publishedId}`,
      json(leader.token, 'PATCH', { status: 'draft' })
    )
    expect(res.status).toBe(200)
    expect(((await res.json()) as { published_at: string | null }).published_at).toBeNull()

    const list = (await (await app.request('/api/public/stories')).json()) as Array<{ id: string }>
    expect(list.map((r) => r.id)).not.toContain(publishedId)
  })
})
