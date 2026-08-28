import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader, createOrgToy, setOrgPickup, cleanupOrg } from '../../helpers/orgs.js'

const BASE = 'http://localhost'

describe('GET /api/public/organizations/:id', () => {
  let leader: TestUser
  let requester: TestUser
  let contributorOrg: string
  let suspendedOrg: string
  let emptyOrg: string
  const contributorTutorialIds: string[] = []

  beforeAll(async () => {
    const admin = adminClient()
    leader = await createTestUser()
    requester = await createTestUser()

    contributorOrg = await createOrg({ createdBy: leader.id, status: 'active' })
    await addLeader(contributorOrg, leader.id)
    // Pickup + leadership are set precisely so the security assertion below has
    // something real to catch — a naive select('*') on organizations would leak both.
    await setOrgPickup(contributorOrg)

    // tutorialsBacked: an approved tutorial with an ACCEPTED tutorial_orgs row
    // for this org. tutorials has no owner_id; difficulty is NOT NULL.
    const { data: backedTut } = await admin
      .from('tutorials')
      .insert({ title: 'Backed Tutorial', difficulty: 'easy', status: 'approved' })
      .select('id')
      .single()
    contributorTutorialIds.push(backedTut!.id)
    await admin.from('tutorial_orgs').insert({
      tutorial_id: backedTut!.id,
      org_id: contributorOrg,
      status: 'accepted',
      responded_by: leader.id,
      responded_at: new Date().toISOString(),
    })

    // tutorialsApproved: an approved tutorial reviewed FOR this org.
    const { data: reviewedTut } = await admin
      .from('tutorials')
      .insert({
        title: 'Reviewed Tutorial',
        difficulty: 'easy',
        status: 'approved',
        reviewed_for_org_id: contributorOrg,
      })
      .select('id')
      .single()
    contributorTutorialIds.push(reviewedTut!.id)

    // toysShared: a published, non-archived org toy. condition NOT NULL (1-10).
    await createOrgToy({ orgId: contributorOrg, name: 'Shared Bear' })

    // toysDelivered: a completed handoff given by this org. The toy row flips
    // to 'draft' on ownership transfer, so it is read via the admin client.
    const { data: deliveredToy } = await admin
      .from('toys')
      .insert({
        name: 'Delivered Truck',
        status: 'draft',
        owner_org_id: contributorOrg,
        quantity: 1,
        condition: 5,
      })
      .select('id')
      .single()
    await admin.from('toy_transactions').insert({
      toy_id: deliveredToy!.id,
      type: 'donation',
      status: 'completed',
      requester_id: requester.id,
      owner_org_id: contributorOrg,
    })

    // Suspended but contributing: must still show, marked, not 404.
    suspendedOrg = await createOrg({ createdBy: leader.id, status: 'suspended' })
    await createOrgToy({ orgId: suspendedOrg, name: 'Suspended Org Toy' })

    // Empty: an org with zero contributions across all four collections.
    emptyOrg = await createOrg({ createdBy: leader.id, status: 'active' })
  })

  afterAll(async () => {
    await cleanupOrg(contributorOrg, contributorTutorialIds)
    await cleanupOrg(suspendedOrg)
    await cleanupOrg(emptyOrg)
    await deleteTestUser(leader.id)
    await deleteTestUser(requester.id)
  })

  it('returns only the public projection for a contributing org', async () => {
    const res = await app.request(`${BASE}/api/public/organizations/${contributorOrg}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as any

    expect(body.id).toBe(contributorOrg)
    expect(body.status).toBe('active')
    expect(body.tutorialsBacked.length).toBeGreaterThanOrEqual(1)
    expect(body.tutorialsApproved.length).toBeGreaterThanOrEqual(1)
    expect(body.toysShared.length).toBeGreaterThanOrEqual(1)
    expect(body.toysDelivered.length).toBeGreaterThanOrEqual(1)

    // Security: this is a dedicated public projection. It must never leak
    // leadership, agreements, email, or pickup details.
    const json = JSON.stringify(body)
    expect(json).not.toContain('org_leaders')
    expect(json).not.toContain('email')
    expect(json).not.toContain('pickup')
  })

  it('shows a suspended org that has still contributed, marked as suspended', async () => {
    const res = await app.request(`${BASE}/api/public/organizations/${suspendedOrg}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.status).toBe('suspended')
    expect(body.toysShared.length).toBeGreaterThanOrEqual(1)
  })

  // An org with nothing to show used to 404, so that it was indistinguishable
  // from one that does not exist. GET /api/public/organizations already lists
  // every org by id and name, so that told a caller nothing they could not
  // already read — while making every such org a dead link from the
  // Organisations page, which links each row to this profile.
  it('returns an empty profile for a zero-contribution org', async () => {
    const res = await app.request(`${BASE}/api/public/organizations/${emptyOrg}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as any
    expect(body.id).toBe(emptyOrg)
    expect(body.tutorialsBacked).toEqual([])
    expect(body.tutorialsApproved).toEqual([])
    expect(body.toysShared).toEqual([])
    expect(body.toysDelivered).toEqual([])
  })

  it('404s for an unknown id', async () => {
    const missing = await app.request(
      `${BASE}/api/public/organizations/00000000-0000-0000-0000-000000000000`
    )
    expect(missing.status).toBe(404)
  })
})
