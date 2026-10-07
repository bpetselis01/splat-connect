/** me-count-badges: one call, every count scoped to the caller. */
// journeys: Q01
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'
import { DECLARATION_VERSION } from '@splat-connect/types'

let me: TestUser
let family: TestUser
let fresh: TestUser
const tutorialIds: string[] = []
let ideaId: string
let printerId: string

const counts = async (token: string) =>
  (await (await app.request('/api/me/counts', { headers: { Authorization: `Bearer ${token}` } })).json()) as Record<string, number>

beforeAll(async () => {
  const sb = adminClient()
  ;[me, family, fresh] = await Promise.all([createTestUser(), createTestUser(), createTestUser()])
  for (const status of ['rejected', 'draft'] as const) {
    const { data, error } = await sb.from('tutorials').insert({ title: `Mine ${status}`, difficulty: 'easy', status }).select('id').single()
    if (error) throw error
    tutorialIds.push(data!.id)
    await sb.from('tutorial_contributors').insert({ tutorial_id: data!.id, profile_id: me.id, role: 'primary' })
  }
  const { data: idea, error } = await sb.from('toy_ideas').insert({ author_id: me.id, title: 'Idea', summary: 'S', status: 'pending' }).select('id').single()
  if (error) throw error
  ideaId = idea!.id
  // An open build from someone else, and one of my own (not counted for me).
  const { error: txError } = await sb.from('toy_transactions').insert([
    { type: 'build', status: 'requested', tutorial_id: tutorialIds[0], build_brief: 'For Leo.', requester_id: family.id, travel_km: 10 },
    { type: 'build', status: 'requested', tutorial_id: tutorialIds[0], build_brief: 'Mine.', requester_id: me.id, travel_km: 10 },
  ])
  if (txError) throw txError
  // A print job waiting on my printer, asked for by the family.
  const { data: p, error: pError } = await sb
    .from('printers')
    .insert({ owner_id: me.id, name: 'Bench', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 })
    .select('id')
    .single()
  if (pError) throw pError
  printerId = p!.id
  const { error: jobError } = await sb.from('toy_transactions').insert({
    type: 'print', status: 'requested', tutorial_id: tutorialIds[0], printer_id: printerId, requester_id: family.id,
    owner_id: me.id, print_group_id: crypto.randomUUID(),
  })
  if (jobError) throw jobError
})

afterAll(async () => {
  const sb = adminClient()
  await sb.from('toy_transactions').delete().in('requester_id', [me.id, family.id])
  await sb.from('printers').delete().eq('id', printerId)
  await sb.from('tutorials').delete().in('id', tutorialIds)
  await sb.from('toy_ideas').delete().eq('id', ideaId)
  await Promise.all([me, family, fresh].map((u) => deleteTestUser(u.id)))
})

describe('GET /api/me/counts', () => {
  it("counts what is waiting on this account and nobody else's", async () => {
    // A query that fails reads 0 and logs; none of these may have.
    const logged = vi.spyOn(console, 'error')
    expect(await counts(me.token)).toMatchObject({ tutorials: 1, challenges: 1, printRequests: 0, printJobs: 1, review: 0, intake: 0, orgOrders: 0 })
    expect(await counts(family.token)).toMatchObject({ tutorials: 0, challenges: 0, printRequests: 1, printJobs: 0 })
    expect(logged.mock.calls.filter((c) => String(c[0]).startsWith('[me/counts]'))).toEqual([])
    logged.mockRestore()
  })

  // Review Focus 4: no orgs, no printers, nothing authored — zeros, not a 500.
  it('is all zeros for an account with nothing, and makers counts every open request', async () => {
    const res = await app.request('/api/me/counts', { headers: { Authorization: `Bearer ${fresh.token}` } })
    expect(res.status).toBe(200)
    const theirs = (await res.json()) as Record<string, number>
    expect(theirs).toMatchObject({ tutorials: 0, challenges: 0, printRequests: 0, printJobs: 0, review: 0, intake: 0, orgOrders: 0 })
    // Other suites or the seed may leave open builds behind, so makers is
    // pinned relatively: fresh sees both new requests, I see all but my own.
    expect(theirs.makers).toBeGreaterThanOrEqual(2)
    expect((await counts(me.token)).makers).toBe(theirs.makers - 1)
  })

  it('needs a session', async () => {
    expect((await app.request('/api/me/counts')).status).toBe(401)
  })
})

describe('GET /api/me/counts for an organisation leader', () => {
  let boss: TestUser
  let orgId: string
  const guides: string[] = []

  beforeAll(async () => {
    const sb = adminClient()
    boss = await createTestUser()
    orgId = await createOrg({ createdBy: boss.id, name: `Counts ${Date.now()}` })
    await addLeader(orgId, boss.id)
    // Review queue, web's rule: pending backings, and accepted ones on a guide
    // still in review. The accepted backing of a live guide is not waiting.
    for (const [guide, backing] of [['approved', 'pending'], ['pending', 'accepted'], ['approved', 'accepted']] as const) {
      const id = await createProject({ authorId: family.id, status: guide })
      guides.push(id)
      await requestBacking({ tutorialId: id, orgId, status: backing })
    }
    const { error: dError } = await sb.from('recycling_dropoffs').insert({
      org_id: orgId, contributor_id: family.id, material: 'PLA', estimated_grams: 2500,
      condition_declared: true, declaration_version: DECLARATION_VERSION,
    })
    if (dError) throw dError
    const { data: p, error: pError } = await sb
      .from('printers')
      .insert({ owner_org_id: orgId, name: 'Org bench', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 })
      .select('id')
      .single()
    if (pError) throw pError
    const { error: jobError } = await sb.from('toy_transactions').insert({
      type: 'print', status: 'requested', tutorial_id: guides[0], printer_id: p!.id, requester_id: family.id,
      owner_org_id: orgId, print_group_id: crypto.randomUUID(),
    })
    if (jobError) throw jobError
  })

  afterAll(async () => {
    await adminClient().from('toy_transactions').delete().eq('owner_org_id', orgId)
    await cleanupOrg(orgId, guides)
    await deleteTestUser(boss.id)
  })

  it("counts the organisation's queue, intake and orders, and none of it as the leader's own printing", async () => {
    expect(await counts(boss.token)).toMatchObject({ review: 2, intake: 1, orgOrders: 1, printJobs: 0 })
  })
})
