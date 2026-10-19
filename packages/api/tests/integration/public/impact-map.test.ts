/**
 * 121 (impact-map): completed handovers by suburb, never at address level and
 * never for fewer than three deliveries in a suburb (Review Focus 2).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, createOrgToy, createProject, cleanupOrg } from '../../helpers/orgs.js'

const url = process.env.SUPABASE_URL ?? 'http://localhost:54321'
const anonKey = process.env.SUPABASE_ANON_KEY ?? ''

let leader: TestUser
let family: TestUser
let orgId: string
let tutorialId: string
let printerId: string
// Made-up suburbs, so other tests' handovers never land in these groups.
const tag = crypto.randomUUID().replace(/[^a-f]/g, '').slice(0, 6)
const THREE = `zedthree${tag}` // three handovers, spelt three ways
const TWO = `zedtwo${tag}` // two handovers, plus a request, a build and a print job
const NOWHERE = `zednowhere${tag}` // three handovers on a postcode with no centroid
const SECRET = `12 Secret Street ${tag}`

async function handover(suburb: string, opts: { postcode?: string; state?: string; status?: string } = {}) {
  const toyId = await createOrgToy({ orgId })
  const { error } = await adminClient().from('toy_transactions').insert({
    toy_id: toyId,
    type: 'donation',
    status: opts.status ?? 'completed',
    requester_id: family.id,
    owner_id: null,
    owner_org_id: orgId,
    pickup_line1: SECRET,
    pickup_suburb: suburb,
    pickup_state: opts.state ?? 'NSW',
    pickup_postcode: opts.postcode ?? '2300',
  })
  if (error) throw new Error(`handover insert failed: ${error.message}`)
}

beforeAll(async () => {
  ;[leader, family] = await Promise.all([createTestUser(), createTestUser()])
  orgId = await createOrg({ createdBy: leader.id, name: `Map test ${tag}` })
  await handover(THREE)
  await handover(`  ${THREE.toUpperCase()} `)
  await handover(THREE, { state: 'nsw' })
  await handover(TWO)
  await handover(TWO)
  await handover(TWO, { status: 'requested' })
  for (let i = 0; i < 3; i++) await handover(NOWHERE, { postcode: '0000' })
  // A completed build and a completed print job in TWO: both share the table
  // and neither is a delivery, so TWO stays at two.
  tutorialId = await createProject({ authorId: leader.id, status: 'approved' })
  const admin = adminClient()
  const where = { pickup_line1: SECRET, pickup_suburb: TWO, pickup_state: 'NSW', pickup_postcode: '2300' }
  const build = await admin.from('toy_transactions').insert({
    type: 'build',
    status: 'completed',
    tutorial_id: tutorialId,
    build_brief: 'A big button for Ollie',
    requester_id: family.id,
    owner_id: leader.id,
    ...where,
  })
  if (build.error) throw new Error(`build insert failed: ${build.error.message}`)
  const printer = await admin
    .from('printers')
    .insert({ owner_id: leader.id, name: `Map printer ${tag}`, materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200, postcode: '2300' })
    .select('id')
    .single()
  if (printer.error) throw new Error(`printer insert failed: ${printer.error.message}`)
  printerId = printer.data.id
  const print = await admin.from('toy_transactions').insert({
    type: 'print',
    status: 'completed',
    tutorial_id: tutorialId,
    printer_id: printerId,
    print_group_id: crypto.randomUUID(),
    requester_id: family.id,
    owner_id: leader.id,
    ...where,
  })
  if (print.error) throw new Error(`print insert failed: ${print.error.message}`)
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await admin.from('printers').delete().eq('id', printerId)
  await cleanupOrg(orgId, [tutorialId])
  await Promise.all([leader, family].map((u) => deleteTestUser(u.id)))
})

const map = async () => {
  const res = await app.request('/api/public/impact/map')
  expect(res.status).toBe(200)
  return (await res.json()) as Array<Record<string, unknown>>
}

describe('GET /api/public/impact/map — 121', () => {
  it('impact_map() exists and never returns a group under three', async () => {
    const { data, error } = await adminClient().rpc('impact_map')
    expect(error).toBeNull()
    for (const row of data as Array<{ deliveries: number }>) expect(row.deliveries).toBeGreaterThanOrEqual(3)
  })

  it('the anon and signed-in keys cannot call impact_map() directly', async () => {
    expect((await createClient(url, anonKey).rpc('impact_map')).error).not.toBeNull()
    const user = createClient(url, anonKey, { global: { headers: { Authorization: `Bearer ${family.token}` } } })
    expect((await user.rpc('impact_map')).error).not.toBeNull()
  })

  it('merges one suburb spelt three ways into one group of three, placed at its postcode centre', async () => {
    const rows = await map()
    const three = rows.filter((r) => String(r.suburb).toLowerCase() === THREE)
    expect(three).toHaveLength(1)
    expect(three[0]).toMatchObject({ state: 'NSW', deliveries: 3 })
    expect(three[0].lat).toBeCloseTo(-32.931, 2)
    expect(three[0].lng).toBeCloseTo(151.776, 2)
  })

  it('leaves out a suburb with two handovers, a request, a build and a print job', async () => {
    expect((await map()).some((r) => String(r.suburb).toLowerCase() === TWO)).toBe(false)
  })

  it('drops a postcode with no centre', async () => {
    expect((await map()).some((r) => String(r.suburb).toLowerCase() === NOWHERE)).toBe(false)
  })

  it('never carries an address or any column but the five', async () => {
    const rows = await map()
    expect(JSON.stringify(rows)).not.toContain('Secret Street')
    for (const r of rows) expect(Object.keys(r).sort()).toEqual(['deliveries', 'lat', 'lng', 'state', 'suburb'])
    for (const r of rows) expect(r.deliveries as number).toBeGreaterThanOrEqual(3)
  })
})
