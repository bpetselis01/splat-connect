/**
 * GET /api/admin/counts: the board's six numbers. Each test performs the
 * action that moves one through its route and reads the count before and
 * after, then undoes it. These are whole-table counts, so they are exact
 * deltas on a database nothing else writes to, as in CI.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { acceptTerms, createProject } from '../../helpers/orgs.js'
import { call, ok } from './api.js'

type Counts = Record<'tutorials' | 'reports' | 'ideas' | 'spotCheck' | 'accounts' | 'organisations', number>
const counts = async (who: TestUser) => (await (await call(who, 'GET', '/admin/counts')).json()) as Counts
const SPOT_CHECK_SAMPLE = 10

let admin: TestUser
let otherAdmin: TestUser
let member: TestUser
const guides: string[] = []
const ideas: string[] = []

beforeAll(async () => {
  ;[admin, otherAdmin, member] = await Promise.all([createTestUser('admin'), createTestUser('admin'), createTestUser('contributor')])
  await acceptTerms(member.id, 'contributor_terms')
})
afterAll(async () => {
  const db = adminClient()
  await db.from('tutorials').delete().in('id', guides)
  await db.from('toy_ideas').delete().in('id', ideas)
  await db.from('member_reports').delete().eq('reporter_id', member.id)
  await db.from('organizations').delete().eq('created_by', member.id)
  await db.from('organization_requests').delete().eq('requester_id', member.id)
  await Promise.all([admin, otherAdmin, member].map((u) => deleteTestUser(u.id)))
})

describe('the admin board', () => {
  it('counts:admin-counts.tutorials rises when an author hands a guide in for review and falls when an admin decides it', async () => {
    const guide = await createProject({ authorId: member.id, status: 'draft' })
    guides.push(guide)
    const before = (await counts(admin)).tutorials

    const { updated_at } = (await adminClient().from('tutorials').select('updated_at').eq('id', guide).single()).data!
    await ok(member, 'PATCH', `/tutorials/${guide}`, { status: 'pending', safety_declared: true, build_minutes: 30, updated_at })
    expect((await counts(admin)).tutorials).toBe(before + 1)

    await ok(admin, 'PATCH', `/admin/tutorials/${guide}/status`, { status: 'approved' })
    expect((await counts(admin)).tutorials).toBe(before)
  })

  it('counts:admin-counts.reports rises when a member files a report and falls when an admin resolves it', async () => {
    const before = (await counts(admin)).reports
    const report = await ok(member, 'POST', '/reports', { subject_kind: 'toy', subject_label: 'Counted drum', category: 'other', body: 'It arrived broken.' })
    expect((await counts(admin)).reports).toBe(before + 1)

    await ok(admin, 'PATCH', `/admin/member-reports/${report.id}`, { status: 'resolved' })
    expect((await counts(admin)).reports).toBe(before)
  })

  it('counts:admin-counts.ideas rises when a member submits an idea and falls when an admin publishes it', async () => {
    const before = (await counts(admin)).ideas
    const idea = await ok(member, 'POST', '/ideas', { title: 'A counted switch', summary: 'Easier to press' })
    ideas.push(idea.id)
    expect((await counts(admin)).ideas).toBe(before + 1)

    await ok(admin, 'PATCH', `/admin/ideas/${idea.id}/status`, { status: 'challenge' })
    expect((await counts(admin)).ideas).toBe(before)
  })

  it("counts:admin-counts.spotCheck rises for the other admin when one approves a guide, and never for the approver's own approvals", async () => {
    const guide = await createProject({ authorId: member.id, status: 'pending' })
    guides.push(guide)
    const [approverBefore, otherBefore] = [(await counts(admin)).spotCheck, (await counts(otherAdmin)).spotCheck]

    await ok(admin, 'PATCH', `/admin/tutorials/${guide}/status`, { status: 'approved' })
    expect((await counts(admin)).spotCheck).toBe(approverBefore)
    // The board shows the sample's size, so the rise is visible only below the cap.
    expect((await counts(otherAdmin)).spotCheck).toBe(Math.min(otherBefore + 1, SPOT_CHECK_SAMPLE))
  })

  it('counts:admin-counts.accounts rises when an account is created and falls when it is deleted', async () => {
    const before = (await counts(admin)).accounts
    const created = await createTestUser('contributor')
    expect((await counts(admin)).accounts).toBe(before + 1)

    await deleteTestUser(created.id)
    expect((await counts(admin)).accounts).toBe(before)
  })

  it('counts:admin-counts.organisations rises when an admin approves an organisation request', async () => {
    const before = (await counts(admin)).organisations
    const request = await ok(member, 'POST', '/organizations/requests', {
      org_name: `Counted Org ${Date.now()}`, what_they_do: 'Builds switch toys.', verification: 'Work email.',
    })
    expect((await counts(admin)).organisations).toBe(before)

    await ok(admin, 'POST', `/admin/organization-requests/${request.id}/approve`, {})
    expect((await counts(admin)).organisations).toBe(before + 1)
  })
})
