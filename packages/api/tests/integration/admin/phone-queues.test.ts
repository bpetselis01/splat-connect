/**
 * The phone's six admin queues through the real admin seat: each action is
 * read back from the database, the author or reporter is told, and the card on
 * /admin (GET /api/admin/counts) moves by one. Test files run serially against
 * one database, so a before/after difference on a count is this test's own.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { addLeader, createOrg, createProject } from '../../helpers/orgs.js'

let admin: TestUser
let author: TestUser
let reporter: TestUser
let leader: TestUser
const ideaIds: string[] = []
const orgIds: string[] = []
const tutorialIds: string[] = []
const extraUsers: TestUser[] = []

const call = (token: string, method: string, path: string, body?: unknown) =>
  app.request(`/api${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
const asAdmin = (method: string, path: string, body?: unknown) => call(admin.token, method, path, body)
const counts = async () => (await (await asAdmin('GET', '/admin/counts')).json()) as Record<string, number>
const notices = async (recipient: string, column: 'idea_id' | 'tutorial_id' | 'member_report_id', id: string) =>
  (await adminClient().from('notifications').select('type, actor_name, body').eq('recipient_id', recipient).eq(column, id)).data ?? []

async function seedIdea(status: 'pending' | 'challenge', title = `Idea ${crypto.randomUUID().slice(0, 8)}`) {
  const { data, error } = await adminClient()
    .from('toy_ideas')
    .insert({ author_id: author.id, title, summary: 'S', description: 'D', intended_use: 'U', primary_user: 'P', status })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  ideaIds.push(data.id)
  return data.id as string
}

async function seedMemberReport(label = 'Drum') {
  const { data, error } = await adminClient()
    .from('member_reports')
    .insert({ reporter_id: reporter.id, subject_kind: 'toy', subject_label: label, category: 'other', body: 'Loose skin.' })
    .select('id')
    .single()
  if (error) throw new Error(error.message)
  return data.id as string
}

async function seedOrg() {
  const id = await createOrg({ createdBy: leader.id })
  orgIds.push(id)
  return id
}

async function seedUser() {
  const u = await createTestUser('contributor')
  extraUsers.push(u)
  return u
}

beforeAll(async () => {
  ;[admin, author, reporter, leader] = await Promise.all([
    createTestUser('admin'), createTestUser('contributor'), createTestUser('contributor'), createTestUser('contributor'),
  ])
})

afterAll(async () => {
  const sb = adminClient()
  await sb.from('toy_ideas').delete().in('id', ideaIds)
  await sb.from('member_reports').delete().eq('reporter_id', reporter.id)
  await sb.from('tutorials').delete().in('id', tutorialIds)
  await sb.from('organizations').delete().in('id', orgIds)
  await Promise.all([admin, author, reporter, leader, ...extraUsers].map((u) => deleteTestUser(u.id)))
})

describe('Accounts', () => {
  it('Q24 WM16 lists every non-admin account newest first, with an exact total the Accounts card shows', async () => {
    const newest = await seedUser()
    const res = await asAdmin('GET', '/admin/contributors')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { accounts: { id: string; role: string }[]; total: number }
    const ids = body.accounts.map((a) => a.id)
    expect(ids[0]).toBe(newest.id)
    expect(ids).toContain(author.id)
    expect(ids).not.toContain(admin.id)
    expect(body.total).toBe((await counts()).accounts)
  })

  it('Q25 WM17 deleting an account removes the profile and the sign-in, and the Accounts card drops by one', async () => {
    const target = await seedUser()
    const before = (await counts()).accounts
    const res = await asAdmin('DELETE', `/admin/contributors/${target.id}`)
    expect(res.status).toBe(204)
    expect((await adminClient().from('profiles').select('id').eq('id', target.id).maybeSingle()).data).toBeNull()
    expect((await adminClient().auth.admin.getUserById(target.id)).data.user).toBeNull()
    expect((await counts()).accounts).toBe(before - 1)
  })

  it('Q25 WM17 refuses the sole leader of an organisation with 409 and leaves the account and the card alone', async () => {
    const sole = await seedUser()
    const orgId = await seedOrg()
    await addLeader(orgId, sole.id)
    const before = (await counts()).accounts
    const res = await asAdmin('DELETE', `/admin/contributors/${sole.id}`)
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Hand over their organisation first.' })
    expect((await adminClient().from('profiles').select('id').eq('id', sole.id).maybeSingle()).data).not.toBeNull()
    expect((await counts()).accounts).toBe(before)
  })
})

describe('Ideas', () => {
  it('Q26 WM11 lists every idea newest first with its status and author name, and the card counts the pending ones', async () => {
    await adminClient().from('profiles').update({ name: 'Ida Author' }).eq('id', author.id)
    const pending = await seedIdea('pending')
    const live = await seedIdea('challenge')
    const res = await asAdmin('GET', '/admin/ideas')
    expect(res.status).toBe(200)
    const rows = (await res.json()) as { id: string; status: string; profiles: { name: string } | null }[]
    expect(rows.find((r) => r.id === pending)).toMatchObject({ status: 'pending', profiles: { name: 'Ida Author' } })
    expect(rows.find((r) => r.id === live)).toMatchObject({ status: 'challenge' })
    expect(rows.findIndex((r) => r.id === live)).toBeLessThan(rows.findIndex((r) => r.id === pending))
    expect((await counts()).ideas).toBe(rows.filter((r) => r.status === 'pending').length)
  })

  it('Q28 WM12 publishing a pending idea makes it a challenge, tells the author, lists it publicly and drops the card by one', async () => {
    const id = await seedIdea('pending')
    const before = (await counts()).ideas
    expect((await asAdmin('PATCH', `/admin/ideas/${id}/status`, { status: 'challenge' })).status).toBe(200)
    const { data } = await adminClient().from('toy_ideas').select('status, review_note').eq('id', id).single()
    expect(data).toEqual({ status: 'challenge', review_note: null })
    expect(await notices(author.id, 'idea_id', id)).toEqual([{ type: 'idea_approved', actor_name: 'SPLAT', body: null }])
    const listed = (await (await app.request('/api/public/challenges')).json()) as { id: string }[]
    expect(listed.map((i) => i.id)).toContain(id)
    expect((await counts()).ideas).toBe(before - 1)
  })

  it('Q29 WM13 rejecting a pending idea keeps the reason, tells the author with it, and drops the card by one', async () => {
    const id = await seedIdea('pending')
    const before = (await counts()).ideas
    expect((await asAdmin('PATCH', `/admin/ideas/${id}/status`, { status: 'rejected', review_note: 'Too close to one we have' })).status).toBe(200)
    const { data } = await adminClient().from('toy_ideas').select('status, review_note').eq('id', id).single()
    expect(data).toEqual({ status: 'rejected', review_note: 'Too close to one we have' })
    expect(await notices(author.id, 'idea_id', id)).toEqual([{ type: 'idea_rejected', actor_name: 'SPLAT', body: 'Too close to one we have' }])
    expect((await counts()).ideas).toBe(before - 1)
  })

  it('Q29 WM13 unpublishing a live challenge with a reason takes it off the public list and tells the author', async () => {
    const id = await seedIdea('challenge')
    expect((await asAdmin('PATCH', `/admin/ideas/${id}/status`, { status: 'rejected', review_note: 'Withdrawn after publication' })).status).toBe(200)
    const { data } = await adminClient().from('toy_ideas').select('status, review_note').eq('id', id).single()
    expect(data).toEqual({ status: 'rejected', review_note: 'Withdrawn after publication' })
    const listed = (await (await app.request('/api/public/challenges')).json()) as { id: string }[]
    expect(listed.map((i) => i.id)).not.toContain(id)
    expect(await notices(author.id, 'idea_id', id)).toEqual([{ type: 'idea_rejected', actor_name: 'SPLAT', body: 'Withdrawn after publication' }])
  })
})

describe('Organisations', () => {
  it('Q32 lists organisations with their leaders, standing and Verified, and the accounts list carries the leader', async () => {
    const orgId = await seedOrg()
    await addLeader(orgId, leader.id)
    await adminClient().from('organizations').update({ status: 'suspended', verified_at: '2026-01-02T00:00:00Z' }).eq('id', orgId)
    const orgs = (await (await asAdmin('GET', '/organizations')).json()) as {
      id: string; status: string; verified_at: string | null; org_leaders: { user_id: string }[]
    }[]
    const row = orgs.find((o) => o.id === orgId)
    expect(row).toMatchObject({ status: 'suspended', verified_at: '2026-01-02T00:00:00+00:00' })
    expect(row!.org_leaders.map((l) => l.user_id)).toEqual([leader.id])
    const { accounts } = (await (await asAdmin('GET', '/admin/contributors')).json()) as { accounts: { id: string }[] }
    expect(accounts.map((a) => a.id)).toContain(leader.id)
  })

  it('Q34 WM18 creating an organisation stores it active with its first leader, and the Organisations card rises by one', async () => {
    const before = (await counts()).organisations
    const res = await asAdmin('POST', '/admin/organizations', { name: 'Phone Queue Org', description: 'Made on a phone', leader_user_id: leader.id })
    expect(res.status).toBe(201)
    const { id } = (await res.json()) as { id: string }
    orgIds.push(id)
    expect((await adminClient().from('organizations').select('name, description, status').eq('id', id).single()).data)
      .toEqual({ name: 'Phone Queue Org', description: 'Made on a phone', status: 'active' })
    expect((await adminClient().from('org_leaders').select('user_id').eq('org_id', id)).data).toEqual([{ user_id: leader.id }])
    expect((await counts()).organisations).toBe(before + 1)
  })

  it('Q35 saving details rewrites the name and description', async () => {
    const orgId = await seedOrg()
    const res = await asAdmin('PATCH', `/admin/organizations/${orgId}`, { name: 'Renamed Org', description: 'New words' })
    expect(res.status).toBe(200)
    expect((await adminClient().from('organizations').select('name, description').eq('id', orgId).single()).data)
      .toEqual({ name: 'Renamed Org', description: 'New words' })
  })

  it('Q36 WM19 adding a leader from the account picker writes the org_leaders row, and adding again is a no-op', async () => {
    const orgId = await seedOrg()
    const second = await seedUser()
    expect((await asAdmin('POST', `/admin/organizations/${orgId}/leaders`, { user_id: second.id })).status).toBe(201)
    expect((await asAdmin('POST', `/admin/organizations/${orgId}/leaders`, { user_id: second.id })).status).toBe(200)
    expect((await adminClient().from('org_leaders').select('user_id').eq('org_id', orgId)).data).toEqual([{ user_id: second.id }])
  })

  it('Q37 WM20 removing a leader deletes the row, and a non-leader is 404', async () => {
    const orgId = await seedOrg()
    const second = await seedUser()
    await addLeader(orgId, second.id)
    expect((await asAdmin('DELETE', `/admin/organizations/${orgId}/leaders/${second.id}`)).status).toBe(204)
    expect((await adminClient().from('org_leaders').select('user_id').eq('org_id', orgId)).data).toEqual([])
    expect((await asAdmin('DELETE', `/admin/organizations/${orgId}/leaders/${second.id}`)).status).toBe(404)
  })

  it('Q38 WM22 suspending stores the standing and reactivating restores it', async () => {
    const orgId = await seedOrg()
    const standing = async () => (await adminClient().from('organizations').select('status').eq('id', orgId).single()).data
    expect((await asAdmin('PATCH', `/admin/organizations/${orgId}`, { status: 'suspended' })).status).toBe(200)
    expect(await standing()).toEqual({ status: 'suspended' })
    expect((await asAdmin('PATCH', `/admin/organizations/${orgId}`, { status: 'active' })).status).toBe(200)
    expect(await standing()).toEqual({ status: 'active' })
  })

  it('Q39 WM21 marking verified stamps verified_at, the organisation list shows it, and removing it clears it', async () => {
    const orgId = await seedOrg()
    const stamp = async () => (await adminClient().from('organizations').select('verified_at').eq('id', orgId).single()).data!.verified_at
    expect((await asAdmin('PATCH', `/admin/organizations/${orgId}`, { verified: true })).status).toBe(200)
    expect(await stamp()).not.toBeNull()
    const orgs = (await (await asAdmin('GET', '/organizations')).json()) as { id: string; verified_at: string | null }[]
    expect(orgs.find((o) => o.id === orgId)!.verified_at).not.toBeNull()
    expect((await asAdmin('PATCH', `/admin/organizations/${orgId}`, { verified: false })).status).toBe(200)
    expect(await stamp()).toBeNull()
  })
})

describe('Reports', () => {
  it('Q40 lists member reports with status and the idea reports with their idea title', async () => {
    const reportId = await seedMemberReport('Zebra toy')
    const ideaId = await seedIdea('challenge', 'Switch train')
    const { data: idea } = await adminClient()
      .from('toy_idea_reports')
      .insert({ idea_id: ideaId, reported_profile_id: reporter.id, reported_by: author.id, reason: 'Rude in the thread' })
      .select('id')
      .single()
    const members = (await (await asAdmin('GET', '/admin/member-reports')).json()) as { id: string; status: string; subject_label: string }[]
    expect(members.find((r) => r.id === reportId)).toMatchObject({ status: 'new', subject_label: 'Zebra toy' })
    const ideas = (await (await asAdmin('GET', '/admin/reports')).json()) as { id: string; resolved_at: string | null; toy_ideas: { title: string } }[]
    expect(ideas.find((r) => r.id === idea!.id)).toMatchObject({ resolved_at: null, toy_ideas: { title: 'Switch train' } })
  })

  it('Q21 WD28 My reports lists the reporter’s own reports with their status and SPLAT’s reply, and nobody else’s', async () => {
    const reportId = await seedMemberReport('Reply toy')
    const fetchMine = async (token: string) =>
      (await (await call(token, 'GET', '/reports')).json()) as { id: string; status: string; note_to_reporter: string | null }[]
    expect((await fetchMine(reporter.token)).find((r) => r.id === reportId)).toMatchObject({ status: 'new', note_to_reporter: null })

    await asAdmin('PATCH', `/admin/member-reports/${reportId}`, { status: 'looking', note_to_reporter: 'Checking with the maker.' })
    expect((await fetchMine(reporter.token)).find((r) => r.id === reportId)).toMatchObject({ status: 'looking', note_to_reporter: 'Checking with the maker.' })
    expect((await fetchMine(author.token)).map((r) => r.id)).not.toContain(reportId)
  })

  it('Q42 WM27 WM29 Looking into it and a note are stored with the handler, tell nobody, and reach the reporter', async () => {
    const reportId = await seedMemberReport()
    const before = (await counts()).reports
    expect((await asAdmin('PATCH', `/admin/member-reports/${reportId}`, { status: 'looking', note_to_reporter: 'We are on it.' })).status).toBe(200)
    expect((await adminClient().from('member_reports').select('status, note_to_reporter, handled_by').eq('id', reportId).single()).data)
      .toEqual({ status: 'looking', note_to_reporter: 'We are on it.', handled_by: admin.id })
    expect(await notices(reporter.id, 'member_report_id', reportId)).toEqual([])
    const mine = (await (await call(reporter.token, 'GET', '/reports')).json()) as { id: string; status: string; note_to_reporter: string }[]
    expect(mine.find((r) => r.id === reportId)).toMatchObject({ status: 'looking', note_to_reporter: 'We are on it.' })
    expect((await counts()).reports).toBe(before)
  })

  it('Q43 WM28 Resolve closes the report, tells the reporter once, shows Resolved on My reports and drops the card by one', async () => {
    const reportId = await seedMemberReport()
    const before = (await counts()).reports
    expect((await asAdmin('PATCH', `/admin/member-reports/${reportId}`, { status: 'resolved' })).status).toBe(200)
    expect((await adminClient().from('member_reports').select('status').eq('id', reportId).single()).data).toEqual({ status: 'resolved' })
    expect(await notices(reporter.id, 'member_report_id', reportId)).toEqual([{ type: 'report_resolved', actor_name: 'SPLAT', body: null }])
    const mine = (await (await call(reporter.token, 'GET', '/reports')).json()) as { id: string; status: string }[]
    expect(mine.find((r) => r.id === reportId)!.status).toBe('resolved')
    expect((await counts()).reports).toBe(before - 1)
  })

  describe('against a person in a challenge', () => {
    let ideaId: string
    let target: TestUser

    const fileReport = async () => {
      const { data } = await adminClient()
        .from('toy_idea_reports')
        .insert({ idea_id: ideaId, reported_profile_id: target.id, reported_by: author.id, reason: 'Made another participant uncomfortable' })
        .select('id')
        .single()
      return data!.id as string
    }
    const participant = async () =>
      (await adminClient().from('toy_idea_participants').select('removed_at').eq('idea_id', ideaId).eq('profile_id', target.id).single()).data!

    beforeAll(async () => {
      target = await seedUser()
      ideaId = await seedIdea('challenge')
      await adminClient().from('toy_idea_participants').insert({ idea_id: ideaId, profile_id: target.id })
    })

    it('Q44 WM30 Dismiss resolves the report with the note and leaves the person in the challenge, unnotified', async () => {
      const reportId = await fileReport()
      const res = await asAdmin('PATCH', `/admin/reports/${reportId}`, { action: 'dismiss', resolution_note: 'Nothing found' })
      expect(res.status).toBe(200)
      expect((await adminClient().from('toy_idea_reports').select('resolution_note, resolved_by, resolved_at').eq('id', reportId).single()).data)
        .toMatchObject({ resolution_note: 'Nothing found', resolved_by: admin.id, resolved_at: expect.any(String) })
      expect((await participant()).removed_at).toBeNull()
      expect(await notices(target.id, 'idea_id', ideaId)).toEqual([])
    })

    it('Q45 WM30 Remove resolves the report, takes the person out of the challenge and tells them in SPLAT’s name', async () => {
      const reportId = await fileReport()
      const res = await asAdmin('PATCH', `/admin/reports/${reportId}`, { action: 'remove', resolution_note: 'Removed and warned' })
      expect(res.status).toBe(200)
      expect((await adminClient().from('toy_idea_reports').select('resolution_note, resolved_at').eq('id', reportId).single()).data)
        .toMatchObject({ resolution_note: 'Removed and warned', resolved_at: expect.any(String) })
      expect((await participant()).removed_at).not.toBeNull()
      expect(await notices(target.id, 'idea_id', ideaId)).toEqual([{ type: 'challenge_removed', actor_name: 'SPLAT', body: null }])
    })

    it('Q46 WM31 Reinstate clears the removal, so the person is a participant again', async () => {
      expect((await participant()).removed_at).not.toBeNull()
      expect((await asAdmin('DELETE', `/admin/ideas/${ideaId}/participants/${target.id}/removal`)).status).toBe(204)
      expect((await participant()).removed_at).toBeNull()
    })
  })
})

describe('Spot-check and unpublishing', () => {
  it('Q47 WM10 lists approved guides an organisation leader approved, not the admin’s own, and the card counts them', async () => {
    const mineId = await createProject({ authorId: author.id, status: 'approved' })
    const theirsId = await createProject({ authorId: author.id, status: 'approved' })
    tutorialIds.push(mineId, theirsId)
    await adminClient().from('tutorials').update({ reviewed_by: admin.id }).eq('id', mineId)
    await adminClient().from('tutorials').update({ reviewed_by: leader.id }).eq('id', theirsId)
    const ids = ((await (await asAdmin('GET', '/admin/spot-check?limit=1000')).json()) as { id: string }[]).map((t) => t.id)
    expect(ids).toContain(theirsId)
    expect(ids).not.toContain(mineId)
    expect((await counts()).spotCheck).toBeGreaterThanOrEqual(1)
  })

  it('Q49 WM09 unpublishing a live guide stores the note, tells its writer, and the Spot-check card drops by one', async () => {
    const id = await createProject({ authorId: author.id, status: 'approved', title: 'Unsafe glue gun guide' })
    tutorialIds.push(id)
    await adminClient().from('tutorials').update({ reviewed_by: leader.id }).eq('id', id)
    const approvedByOthers = async () =>
      (await adminClient().from('tutorials').select('id', { count: 'exact', head: true }).eq('status', 'approved').not('reviewed_by', 'is', null).neq('reviewed_by', admin.id)).count!
    const before = await approvedByOthers()
    const res = await asAdmin('PATCH', `/admin/tutorials/${id}/status`, { status: 'rejected', rejection_note: 'Step 4 is unsafe as written' })
    expect(res.status).toBe(200)
    expect((await adminClient().from('tutorials').select('status, rejection_note').eq('id', id).single()).data)
      .toEqual({ status: 'rejected', rejection_note: 'Step 4 is unsafe as written' })
    expect(await notices(author.id, 'tutorial_id', id)).toEqual([
      { type: 'tutorial_rejected', actor_name: 'SPLAT', body: 'Step 4 is unsafe as written' },
    ])
    expect(await approvedByOthers()).toBe(before - 1)
    expect((await counts()).spotCheck).toBe(Math.min(before - 1, 10))
  })
})
