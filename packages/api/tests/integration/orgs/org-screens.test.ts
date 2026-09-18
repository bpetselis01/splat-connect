/**
 * The organisation's own screens (059) and the queue that creates one (060).
 *
 * The rules with teeth:
 *
 * - **Credit is minted by the organisation, never by the contributor.** 059
 *   splits the insert policy from the update policy so a contributor cannot
 *   write `credit_grams` at all, and the route refuses a credit larger than the
 *   weight because no yield turns two kilos of bottles into three of filament.
 * - **A story cannot be published without consent.** A check constraint as well
 *   as a route check — the button is the courtesy, the constraint is the
 *   guarantee.
 * - **An online event's joining link is never public.** The public endpoint does
 *   not select it, so there is nothing to leak.
 * - **Approving a request creates the organisation and appoints the requester,
 *   once.** A double-click must not mint two organisations.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { DECLARATION_VERSION } from '@splat-connect/types'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let leader: TestUser
let contributor: TestUser
let siteAdmin: TestUser
let orgId: string
let requestId: string
let createdOrgId: string | null = null

const authed = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })
const json = (token: string, method: string, body: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})

beforeAll(async () => {
  leader = await createTestUser('contributor')
  contributor = await createTestUser('contributor')
  siteAdmin = await createTestUser('admin')
  const admin = adminClient()

  const { data: org } = await admin
    .from('organizations')
    .insert({ name: `Northside Collective ${Date.now()}`, status: 'active' })
    .select('id')
    .single()
  orgId = org!.id
  await admin.from('org_leaders').insert({ org_id: orgId, user_id: leader.id })
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('recycling_dropoffs').delete().eq('org_id', orgId)
  await admin.from('org_events').delete().eq('org_id', orgId)
  await admin.from('org_stories').delete().eq('org_id', orgId)
  await admin.from('organization_requests').delete().eq('requester_id', contributor.id)
  if (createdOrgId) await admin.from('organizations').delete().eq('id', createdOrgId)
  await admin.from('organizations').delete().eq('id', orgId)
  await Promise.all([
    deleteTestUser(leader.id),
    deleteTestUser(contributor.id),
    deleteTestUser(siteAdmin.id),
  ])
})

describe('the profile editor', () => {
  it('lets a leader write the public fields and nobody else', async () => {
    const byOther = await app.request(
      `/api/organizations/${orgId}/profile`,
      json(contributor.token, 'PATCH', { about: 'Not mine to write' })
    )
    // 404 rather than 403 for a non-leader, matching the pickup routes: a 403
    // would confirm the row exists to somebody with no claim on it.
    expect(byOther.status).toBe(404)

    const byLeader = await app.request(
      `/api/organizations/${orgId}/profile`,
      json(leader.token, 'PATCH', {
        about: 'We run a Thursday bench in Newtown.',
        capabilities: ['Has a printer', 'Takes recycling'],
        suburb: 'Newtown',
        state: 'NSW',
        rate_note: 'Parts at cost, no charge for labour.',
        recycling_materials: ['PLA', 'PETG'],
      })
    )
    expect(byLeader.status).toBe(200)
    const body = (await byLeader.json()) as { about: string; capabilities: string[] }
    expect(body.about).toContain('Thursday bench')
    expect(body.capabilities).toEqual(['Has a printer', 'Takes recycling'])
  })

  it('shows those fields on the public profile', async () => {
    const res = await app.request(`/api/public/organizations/${orgId}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as { suburb: string; recycling_materials: string[] }
    expect(body.suburb).toBe('Newtown')
    expect(body.recycling_materials).toEqual(['PLA', 'PETG'])
  })
})

describe('events and stories', () => {
  it('keeps an online event’s joining link off the public profile', async () => {
    const created = await app.request(
      `/api/organizations/${orgId}/events`,
      json(leader.token, 'POST', {
        title: 'Online switch clinic',
        starts_at: new Date(Date.now() + 86400000).toISOString(),
        format: 'online',
        online_url: 'https://meet.example.invalid/secret-room',
        status: 'published',
      })
    )
    expect(created.status).toBe(201)

    const publicView = await app.request(`/api/public/organizations/${orgId}`)
    const raw = await publicView.text()
    expect(raw).toContain('Online switch clinic')
    // The whole rule in one assertion: the link is not in the payload at all.
    expect(raw).not.toContain('secret-room')
  })

  it('refuses an in-person event with nowhere to be', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/events`,
      json(leader.token, 'POST', {
        title: 'Somewhere',
        starts_at: new Date(Date.now() + 86400000).toISOString(),
        format: 'in_person',
      })
    )
    expect(res.status).toBe(400)
  })

  it('refuses publishing a story without consent, and allows it with', async () => {
    const withoutConsent = await app.request(
      `/api/organizations/${orgId}/stories`,
      json(leader.token, 'POST', {
        kind: 'delivery',
        title: 'A bubble machine for Leo',
        summary: 'One press, four seconds of bubbles.',
        body: 'The long version.',
        byline: 'Sam, volunteer',
        status: 'published',
        consent_confirmed: false,
      })
    )
    expect(withoutConsent.status).toBe(400)

    const withConsent = await app.request(
      `/api/organizations/${orgId}/stories`,
      json(leader.token, 'POST', {
        kind: 'delivery',
        title: 'A bubble machine for Leo',
        summary: 'One press, four seconds of bubbles.',
        body: 'The long version.',
        byline: 'Sam, volunteer',
        status: 'published',
        consent_confirmed: true,
      })
    )
    expect(withConsent.status).toBe(201)
  })

  it('shows a leader their drafts and the public nothing', async () => {
    const created = await app.request(
      `/api/organizations/${orgId}/events`,
      json(leader.token, 'POST', {
        title: 'Draft bench day',
        starts_at: new Date(Date.now() + 172800000).toISOString(),
        format: 'in_person',
        location: 'The shed',
      })
    )
    expect(created.status).toBe(201)

    const leaderView = await app.request(`/api/organizations/${orgId}/events`, authed(leader.token))
    const leaderRows = (await leaderView.json()) as Array<{ title: string }>
    expect(leaderRows.some((e) => e.title === 'Draft bench day')).toBe(true)

    const publicView = await app.request(`/api/public/organizations/${orgId}`)
    expect(await publicView.text()).not.toContain('Draft bench day')
  })
})

describe('recycling intake', () => {
  let dropoffId: string

  it('refuses a booking under the two-kilo minimum and one not declared', async () => {
    const small = await app.request(
      `/api/organizations/${orgId}/recycling`,
      json(contributor.token, 'POST', {
        material: 'PLA',
        estimated_grams: 500,
        condition_declared: true,
      })
    )
    expect(small.status).toBe(400)

    const undeclared = await app.request(
      `/api/organizations/${orgId}/recycling`,
      json(contributor.token, 'POST', { material: 'PLA', estimated_grams: 4000 })
    )
    expect(undeclared.status).toBe(400)

    // Chain: a stale tab would otherwise record consent to a list nobody has
    //        read. The client's claimed version is checked against the current
    //        one rather than stored as given (063).
    const stale = await app.request(
      `/api/organizations/${orgId}/recycling`,
      json(contributor.token, 'POST', {
        material: 'PLA',
        estimated_grams: 4000,
        condition_declared: true,
        declaration_version: 'v0-from-a-stale-tab',
      })
    )
    expect(stale.status).toBe(409)
  })

  it('books one in', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/recycling`,
      json(contributor.token, 'POST', {
        material: 'PLA',
        estimated_grams: 4000,
        condition_declared: true,
        declaration_version: DECLARATION_VERSION,
        note: 'Milk bottle tops, sorted.',
      })
    )
    expect(res.status).toBe(201)
    // The wording is recorded, not merely the fact of ticking.
    expect(((await res.clone().json()) as { declaration_version: string }).declaration_version).toBe(
      DECLARATION_VERSION
    )
    const body = (await res.json()) as { id: string; status: string; credit_grams: null }
    expect(body.status).toBe('booked')
    expect(body.credit_grams).toBeNull()
    dropoffId = body.id
  })

  /*
   * Why: this is the rule the whole screen exists for. A contributor who could
   * update their own booking could write their own credit.
   */
  it('refuses a contributor weighing in their own drop-off', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/recycling/${dropoffId}`,
      json(contributor.token, 'PATCH', {
        status: 'received',
        weighed_grams: 4000,
        credit_grams: 4000,
      })
    )
    expect(res.status).toBe(404)
  })

  it('refuses a credit larger than the weight', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/recycling/${dropoffId}`,
      json(leader.token, 'PATCH', {
        status: 'received',
        weighed_grams: 3800,
        credit_grams: 5000,
      })
    )
    expect(res.status).toBe(400)
  })

  it('lets the leader weigh it in', async () => {
    const res = await app.request(
      `/api/organizations/${orgId}/recycling/${dropoffId}`,
      json(leader.token, 'PATCH', {
        status: 'received',
        weighed_grams: 3800,
        credit_grams: 2850,
      })
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string; credit_grams: number; decided_by: string }
    expect(body.status).toBe('received')
    expect(body.credit_grams).toBe(2850)
    expect(body.decided_by).toBe(leader.id)
  })
})

describe('asking for an organisation', () => {
  it('files one, and refuses a second open ask for the same name', async () => {
    const res = await app.request(
      '/api/organizations/requests',
      json(contributor.token, 'POST', {
        org_name: 'Eastside Therapy',
        what_they_do: 'Paediatric OT, twelve therapists.',
        verification: 'My work email is on eastside.example.',
      })
    )
    expect(res.status).toBe(201)
    requestId = ((await res.json()) as { id: string }).id

    const again = await app.request(
      '/api/organizations/requests',
      json(contributor.token, 'POST', {
        org_name: 'Eastside Therapy',
        what_they_do: 'Same again',
        verification: 'Same again',
      })
    )
    expect(again.status).toBe(409)
  })

  it('refuses a decline with no reason', async () => {
    const res = await app.request(
      `/api/admin/organization-requests/${requestId}/decline`,
      json(siteAdmin.token, 'POST', {})
    )
    expect(res.status).toBe(400)
  })

  it('will not let the requester approve their own request', async () => {
    const res = await app.request(
      `/api/admin/organization-requests/${requestId}/approve`,
      json(contributor.token, 'POST', {})
    )
    // The route is admin-gated by middleware, and 060's function checks again.
    expect([401, 403]).toContain(res.status)
  })

  it('creates the organisation and appoints the requester, exactly once', async () => {
    const first = await app.request(
      `/api/admin/organization-requests/${requestId}/approve`,
      json(siteAdmin.token, 'POST', {})
    )
    expect(first.status).toBe(200)
    const body = (await first.json()) as { outcome: string; organization_id: string }
    expect(body.outcome).toBe('approved')
    createdOrgId = body.organization_id

    const admin = adminClient()
    const { data: leaders } = await admin
      .from('org_leaders')
      .select('user_id')
      .eq('org_id', createdOrgId)
    expect((leaders ?? []).map((l: { user_id: string }) => l.user_id)).toEqual([contributor.id])

    // A double-click must not mint a second organisation.
    const second = await app.request(
      `/api/admin/organization-requests/${requestId}/approve`,
      json(siteAdmin.token, 'POST', {})
    )
    const again = (await second.json()) as { outcome: string; organization_id: string }
    expect(again.outcome).toBe('already_reviewed')
    expect(again.organization_id).toBe(createdOrgId)

    const { count } = await admin
      .from('organizations')
      .select('id', { count: 'exact', head: true })
      .eq('name', 'Eastside Therapy')
    expect(count).toBe(1)
  })
})
