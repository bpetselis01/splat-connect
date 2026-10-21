/**
 * GET /api/me/counts: the My SPLAT numbers. Each test performs the action
 * that moves one number through its route, reads the count before and after,
 * then undoes it and reads it again. Absolute values are used only for
 * accounts made here; "makers" is a delta because other suites leave open
 * build requests behind.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { DECLARATION_VERSION } from '@splat-connect/types'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader, acceptTerms, createProject, cleanupOrg } from '../../helpers/orgs.js'
import { call, ok } from './api.js'

type Counts = Record<'tutorials' | 'challenges' | 'makers' | 'printRequests' | 'printJobs' | 'review' | 'intake' | 'orgOrders', number>
const counts = async (who: TestUser) => (await (await call(who, 'GET', '/me/counts')).json()) as Counts
const PICKUP = { pickup_line1: '1 Test St', pickup_suburb: 'Newtown', pickup_state: 'NSW', pickup_postcode: '2042' }

let admin: TestUser
let family: TestUser
let author: TestUser
let maker: TestUser
let printOwner: TestUser
let leader: TestUser
let orgId: string
let buildGuide: string
let stlIds: string[]
let personalPrinter: string
let orgPrinter: string
const guides: string[] = []

const askPrint = async (printerId: string) =>
  (await ok(family, 'POST', '/toy-transactions/print', { printer_ids: [printerId], tutorial_id: buildGuide, stl_file_ids: stlIds })).id

beforeAll(async () => {
  ;[admin, family, author, maker, printOwner, leader] = await Promise.all([
    createTestUser('admin'), createTestUser('contributor'), createTestUser('contributor'),
    createTestUser('contributor'), createTestUser('contributor'), createTestUser('contributor'),
  ])
  await acceptTerms(author.id, 'contributor_terms')
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  const db = adminClient()
  buildGuide = (await db.from('tutorials').insert({ title: 'Counted guide', description: 'x', difficulty: 'easy', status: 'approved' }).select('id').single()).data!.id
  stlIds = (await db.from('stl_files').insert([{ tutorial_id: buildGuide, filename: 'part.stl', file_url: `${buildGuide}/part.stl` }]).select('id')).data!.map((f) => f.id)
  const machine = (row: Record<string, unknown>) =>
    db.from('printers').insert({ name: 'Counted printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200, capacity: 3, ...row }).select('id').single()
  personalPrinter = (await machine({ owner_id: printOwner.id })).data!.id
  orgPrinter = (await machine({ owner_org_id: orgId })).data!.id
})

afterAll(async () => {
  const db = adminClient()
  await db.from('toy_transactions').delete().eq('tutorial_id', buildGuide)
  await db.from('printers').delete().in('id', [personalPrinter, orgPrinter])
  await db.from('toy_ideas').delete().in('author_id', [author.id, maker.id])
  await db.from('recycling_dropoffs').delete().eq('org_id', orgId)
  await cleanupOrg(orgId, [buildGuide, ...guides])
  await Promise.all([admin, family, author, maker, printOwner, leader].map((u) => deleteTestUser(u.id)))
})

describe('the My SPLAT numbers', () => {
  it('counts:me-counts.tutorials rises when an admin returns the guide to its author', async () => {
    const guide = await createProject({ authorId: author.id, status: 'pending' })
    guides.push(guide)
    expect((await counts(author)).tutorials).toBe(0)

    await ok(admin, 'PATCH', `/admin/tutorials/${guide}/status`, { status: 'rejected', review_note: 'Needs a clearer step 3' })
    expect((await counts(author)).tutorials).toBe(1)

    await ok(admin, 'PATCH', `/admin/tutorials/${guide}/status`, { status: 'approved' })
    expect((await counts(author)).tutorials).toBe(0)
  })

  it('counts:me-counts.challenges counts a submitted idea, and a joined challenge, and drops the join on leaving', async () => {
    expect((await counts(author)).challenges).toBe(0)
    const idea = await ok(author, 'POST', '/ideas', { title: 'A counted switch', summary: 'Easier to press' })
    expect((await counts(author)).challenges).toBe(1)

    await ok(admin, 'PATCH', `/admin/ideas/${idea.id}/status`, { status: 'challenge' })
    expect((await counts(maker)).challenges).toBe(0)
    await ok(maker, 'POST', `/ideas/${idea.id}/join`, {})
    expect((await counts(maker)).challenges).toBe(1)
    expect((await counts(author)).challenges).toBe(1)

    await ok(maker, 'DELETE', `/ideas/${idea.id}/participants/${maker.id}`)
    expect((await counts(maker)).challenges).toBe(0)
  })

  it('counts:me-counts.makers rises for everyone else when a family posts an open build, and not for the family', async () => {
    const [familyBefore, makerBefore] = [(await counts(family)).makers, (await counts(maker)).makers]
    const post = await ok(family, 'POST', '/toy-transactions/build', { tutorial_id: buildGuide, build_brief: 'For Leo', requester_suburb: 'Newtown', travel_km: 20 })
    expect((await counts(maker)).makers).toBe(makerBefore + 1)
    expect((await counts(family)).makers).toBe(familyBefore)

    await ok(family, 'POST', `/toy-transactions/${post.id}/withdraw`)
    expect((await counts(maker)).makers).toBe(makerBefore)
  })

  it('counts:me-counts.printRequests rises for the asking family and falls when they withdraw', async () => {
    expect((await counts(family)).printRequests).toBe(0)
    const id = await askPrint(personalPrinter)
    expect((await counts(family)).printRequests).toBe(1)
    expect((await counts(printOwner)).printRequests).toBe(0)

    await ok(family, 'POST', `/toy-transactions/${id}/withdraw`)
    expect((await counts(family)).printRequests).toBe(0)
  })

  it('counts:me-counts.printJobs rises for the printer when asked and falls once they accept', async () => {
    expect((await counts(printOwner)).printJobs).toBe(0)
    const id = await askPrint(personalPrinter)
    expect(await counts(printOwner)).toMatchObject({ printJobs: 1, orgOrders: 0 })

    await ok(printOwner, 'POST', `/toy-transactions/${id}/accept`, PICKUP)
    expect((await counts(printOwner)).printJobs).toBe(0)
    await ok(family, 'POST', `/toy-transactions/${id}/withdraw`)
  })

  it("counts:me-counts.orgOrders rises for the organisation's leader when its printer is asked, falls when they decline, and is never their own printJobs", async () => {
    expect(await counts(leader)).toMatchObject({ orgOrders: 0, printJobs: 0 })
    const id = await askPrint(orgPrinter)
    expect(await counts(leader)).toMatchObject({ orgOrders: 1, printJobs: 0 })

    await ok(leader, 'POST', `/toy-transactions/${id}/reject`, { reason: 'Machine is down this week' })
    expect((await counts(leader)).orgOrders).toBe(0)
  })

  it('counts:me-counts.review rises for the leader when an author asks the organisation to back a guide, and falls when they decline', async () => {
    const guide = await createProject({ authorId: author.id, status: 'draft' })
    guides.push(guide)
    expect((await counts(leader)).review).toBe(0)

    await ok(author, 'POST', `/tutorials/${guide}/orgs`, { org_id: orgId })
    expect((await counts(leader)).review).toBe(1)

    await ok(leader, 'POST', `/tutorials/${guide}/orgs/${orgId}/decline`)
    expect((await counts(leader)).review).toBe(0)
  })

  it('counts:me-counts.intake rises for the leader when a family books a drop-off, and falls when they cancel it', async () => {
    expect((await counts(leader)).intake).toBe(0)
    const drop = await ok(family, 'POST', `/organizations/${orgId}/recycling`, {
      material: 'PLA', estimated_grams: 2500, condition_declared: true, declaration_version: DECLARATION_VERSION,
    })
    expect((await counts(leader)).intake).toBe(1)

    await ok(family, 'POST', `/organizations/${orgId}/recycling/${drop.id}/cancel`)
    expect((await counts(leader)).intake).toBe(0)
  })
})
