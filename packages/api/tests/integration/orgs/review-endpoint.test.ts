import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader, acceptTerms, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

let author: TestUser
let leader: TestUser
let untermed: TestUser
let orgA: string
let orgB: string
let untermedOrg: string
let single: string
let collaborative: string
let untermedProject: string

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
})

beforeAll(async () => {
  author = await createTestUser('contributor')
  leader = await createTestUser('contributor')
  untermed = await createTestUser('contributor')
  await acceptTerms(leader.id, 'org_leader_terms')

  orgA = await createOrg({ createdBy: leader.id, name: 'Riverside Therapy' })
  await addLeader(orgA, leader.id)
  orgB = await createOrg({ createdBy: leader.id, name: 'Northside Clinic' })
  await addLeader(orgB, leader.id)
  untermedOrg = await createOrg({ createdBy: untermed.id })
  await addLeader(untermedOrg, untermed.id)

  single = await createProject({ authorId: author.id })
  await requestBacking({ tutorialId: single, orgId: orgA, status: 'accepted' })

  collaborative = await createProject({ authorId: author.id })
  await requestBacking({ tutorialId: collaborative, orgId: orgA, status: 'accepted' })
  await requestBacking({ tutorialId: collaborative, orgId: orgB, status: 'accepted' })

  untermedProject = await createProject({ authorId: author.id })
  await requestBacking({ tutorialId: untermedProject, orgId: untermedOrg, status: 'accepted' })
})

afterAll(async () => {
  await cleanupOrg(orgA, [single, collaborative])
  await cleanupOrg(orgB)
  await cleanupOrg(untermedOrg, [untermedProject])
  await deleteTestUser(author.id)
  await deleteTestUser(leader.id)
  await deleteTestUser(untermed.id)
})

describe('POST /api/tutorials/:id/review', () => {
  it('approves and writes the whole audit trail', async () => {
    const res = await app.request(`/api/tutorials/${single}/review`, authed(leader.token, {
      method: 'POST',
      body: JSON.stringify({ status: 'approved' }),
    }))
    expect(res.status).toBe(200)

    const { data } = await adminClient()
      .from('tutorials')
      .select('status, reviewed_by, reviewed_for_org_id, reviewed_at')
      .eq('id', single)
      .single()
    expect(data).toMatchObject({
      status: 'approved', reviewed_by: leader.id, reviewed_for_org_id: orgA,
    })
    expect(data?.reviewed_at).not.toBeNull()

    await adminClient().from('tutorials').update({
      status: 'pending', reviewed_by: null, reviewed_for_org_id: null,
    }).eq('id', single)
  })

  it("requires org_id when several of the caller's orgs back the project", async () => {
    const res = await app.request(`/api/tutorials/${collaborative}/review`, authed(leader.token, {
      method: 'POST',
      body: JSON.stringify({ status: 'approved' }),
    }))
    expect(res.status).toBe(400)
  })

  it('credits the named organisation when given one', async () => {
    const res = await app.request(`/api/tutorials/${collaborative}/review`, authed(leader.token, {
      method: 'POST',
      body: JSON.stringify({ status: 'approved', org_id: orgB }),
    }))
    expect(res.status).toBe(200)

    const { data } = await adminClient()
      .from('tutorials').select('reviewed_for_org_id').eq('id', collaborative).single()
    expect(data?.reviewed_for_org_id).toBe(orgB)
  })

  it('refuses an org that is not backing the project', async () => {
    const res = await app.request(`/api/tutorials/${single}/review`, authed(leader.token, {
      method: 'POST',
      body: JSON.stringify({ status: 'approved', org_id: orgB }),
    }))
    expect(res.status).toBe(400)
  })

  it('requires a note when rejecting', async () => {
    const res = await app.request(`/api/tutorials/${single}/review`, authed(leader.token, {
      method: 'POST',
      body: JSON.stringify({ status: 'rejected', rejection_note: '   ' }),
    }))
    expect(res.status).toBe(400)
  })

  it('rejects with a note', async () => {
    const res = await app.request(`/api/tutorials/${single}/review`, authed(leader.token, {
      method: 'POST',
      body: JSON.stringify({ status: 'rejected', rejection_note: 'Step 4 is unsafe as written' }),
    }))
    expect(res.status).toBe(200)

    const { data } = await adminClient()
      .from('tutorials').select('status, rejection_note').eq('id', single).single()
    expect(data).toMatchObject({
      status: 'rejected', rejection_note: 'Step 4 is unsafe as written',
    })
  })

  it('403s for a leader who has not accepted the leader terms', async () => {
    // The grant's terms conjunct sits in the policy's USING clause, so the write
    // matches zero rows. This is the assertion that only means something because
    // the gate lives in RLS rather than in this route.
    const res = await app.request(`/api/tutorials/${untermedProject}/review`, authed(untermed.token, {
      method: 'POST',
      body: JSON.stringify({ status: 'approved' }),
    }))
    expect(res.status).toBe(403)

    await acceptTerms(untermed.id, 'org_leader_terms')
    const after = await app.request(`/api/tutorials/${untermedProject}/review`, authed(untermed.token, {
      method: 'POST',
      body: JSON.stringify({ status: 'approved' }),
    }))
    expect(after.status).toBe(200)
  })

  it('403s for the author, who leads nothing', async () => {
    const res = await app.request(`/api/tutorials/${single}/review`, authed(author.token, {
      method: 'POST',
      body: JSON.stringify({ status: 'approved' }),
    }))
    expect(res.status).toBe(403)
  })

  it('refuses a status other than approved or rejected', async () => {
    const res = await app.request(`/api/tutorials/${single}/review`, authed(leader.token, {
      method: 'POST',
      body: JSON.stringify({ status: 'pending' }),
    }))
    expect(res.status).toBe(400)
  })
})

describe('GET /api/tutorials/:id after review', () => {
  // Tests: the detail endpoint names the reviewer and their organisation
  // How:   leader approves via the endpoint, then fetches the tutorial
  // Chain: both project pages show "approved by X of Y" — with ids alone an admin
  //        would be overriding a decision without seeing whose it was
  it('names the reviewer and the organisation they acted for', async () => {
    const project = await createProject({ authorId: author.id })
    await requestBacking({ tutorialId: project, orgId: orgA, status: 'accepted' })
    await app.request(`/api/tutorials/${project}/review`, authed(leader.token, {
      method: 'POST',
      body: JSON.stringify({ status: 'approved' }),
    }))

    const res = await app.request(`/api/tutorials/${project}`, authed(leader.token))
    const body = (await res.json()) as {
      reviewer: { name: string } | null
      reviewed_for: { name: string } | null
    }
    expect(body.reviewer).not.toBeNull()
    expect(body.reviewed_for?.name).toBe('Riverside Therapy')

    await adminClient().from('tutorials').delete().eq('id', project)
  })
})
