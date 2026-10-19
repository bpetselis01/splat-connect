// journeys: (none — route coverage; no journey row names this route yet)
/**
 * GET /api/admin/build-requests is the makers-wanted oversight queue: open
 * build requests oldest first, with "unclaimed too long" (14 days) and
 * "claimed and silent" (10 idle days) computed from the clock.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let admin: TestUser
let member: TestUser
let maker: TestUser
let family: TestUser
let guide: string
const tx: Record<string, string> = {}

const daysAgo = (n: number) => new Date(Date.now() - n * 864e5).toISOString()
const queue = async () => {
  const res = await app.request('/api/admin/build-requests', { headers: { Authorization: `Bearer ${admin.token}` } })
  expect(res.status).toBe(200)
  const rows = (await res.json()) as Array<Record<string, unknown> & { id: string }>
  return rows.filter((r) => r.tutorial_id === guide)
}

beforeAll(async () => {
  ;[admin, member, maker, family] = await Promise.all([createTestUser('admin'), createTestUser('contributor'), createTestUser('contributor'), createTestUser('contributor')])
  guide = await createProject({ authorId: maker.id, status: 'approved', title: 'Queue Fixture Guide' })
  const sb = adminClient()
  const row = (over: Record<string, unknown>) => ({ type: 'build', tutorial_id: guide, requester_id: family.id, build_brief: 'For Leo', ...over })
  const make = async (name: string, over: Record<string, unknown>) => {
    const { data, error } = await sb.from('toy_transactions').insert(row(over)).select('id').single()
    if (error) throw new Error(error.message)
    tx[name] = data.id
  }
  await make('stale', { status: 'requested', owner_id: null, created_at: daysAgo(20) })
  await make('fresh', { status: 'requested', owner_id: null, created_at: daysAgo(1) })
  await make('claimed', { status: 'accepted', owner_id: maker.id, created_at: daysAgo(30), updated_at: daysAgo(12) })
  await make('done', { status: 'completed', owner_id: maker.id, created_at: daysAgo(40) })
})
afterAll(async () => {
  await adminClient().from('toy_transactions').delete().eq('tutorial_id', guide)
  await adminClient().from('tutorials').delete().eq('id', guide)
  for (const u of [admin, member, maker, family]) await deleteTestUser(u.id)
})

describe('admin build-request queue', () => {
  it('is admin-only', async () => {
    expect((await app.request('/api/admin/build-requests', { headers: { Authorization: `Bearer ${member.token}` } })).status).toBe(403)
    expect((await app.request('/api/admin/build-requests')).status).toBe(401)
  })

  it('lists open requests oldest first with the guide title, and leaves out a finished build', async () => {
    const rows = await queue()
    expect(rows.map((r) => r.id)).toEqual([tx.claimed, tx.stale, tx.fresh])
    expect(rows.every((r) => r.tutorial_title === 'Queue Fixture Guide')).toBe(true)
  })

  it('flags an unclaimed request after 14 days and a claimed one that has been silent for 10', async () => {
    const byId = Object.fromEntries((await queue()).map((r) => [r.id, r]))
    expect(byId[tx.stale]).toMatchObject({ age_days: 20, unclaimed_too_long: true, claimed_and_silent: false })
    expect(byId[tx.fresh]).toMatchObject({ age_days: 1, unclaimed_too_long: false, claimed_and_silent: false })
    expect(byId[tx.claimed]).toMatchObject({ age_days: 30, idle_days: 12, unclaimed_too_long: false, claimed_and_silent: true })
  })
})
