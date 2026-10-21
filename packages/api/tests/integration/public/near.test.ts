/**
 * near=<postcode> and within=<km> on the four lists (099): km on every row,
 * nearest first, unknown last, and nobody's postcode in the answer. The two
 * public lists measure only for a signed-in caller, so an anonymous one cannot
 * narrow a radius until it has bisected somebody's postcode.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createUserClient } from '../../../src/supabase/client.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg } from '../../helpers/orgs.js'

let viewer: TestUser
let near: TestUser
let far: TestUser
let family: TestUser
let tutorialId: string
let orgId: string
const printerIds: Record<string, string> = {}
let toyId: string
let buildId: string

const authed = (u: TestUser) => ({ headers: { Authorization: `Bearer ${u.token}` } })

beforeAll(async () => {
  ;[viewer, near, far, family] = await Promise.all([1, 2, 3, 4].map(() => createTestUser('contributor')))
  const admin = adminClient()
  await admin.from('profiles').update({ pickup_postcode: '2042' }).eq('id', near.id)
  await admin.from('profiles').update({ pickup_postcode: '2042' }).eq('id', family.id)
  const machine = async (owner: TestUser, postcode: string | null) =>
    (
      await admin
        .from('printers')
        .insert({ owner_id: owner.id, name: 'Near test', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200, postcode })
        .select('id')
        .single()
    ).data!.id as string
  printerIds.near = await machine(near, '2042')
  printerIds.far = await machine(far, '3000')
  printerIds.none = await machine(far, null)
  // Four digits, but not an ABS postal area: no centre, so no distance.
  printerIds.unknown = await machine(far, '0001')
  const { data: toy } = await admin
    .from('toys')
    .insert({ name: 'Near toy', condition: 8, owner_id: near.id, quantity: 1, offer_type: 'donation', status: 'published', photo_urls: ['https://example.com/near.jpg'] })
    .select('id')
    .single()
  toyId = toy!.id
  orgId = await createOrg({ createdBy: far.id })
  await admin.from('organizations').update({ pickup_postcode: '3000' }).eq('id', orgId)
  const { data: t } = await admin
    .from('tutorials')
    .insert({ title: 'Near build', description: 'x', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = t!.id
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await admin.from('printers').delete().in('id', Object.values(printerIds))
  await admin.from('toys').delete().eq('id', toyId)
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await admin.from('organizations').delete().eq('id', orgId)
  await Promise.all([viewer, near, far, family].map((u) => deleteTestUser(u.id)))
})

describe('printers near a postcode', () => {
  it('R01 puts the nearest first, the unknown last, with km on each', async () => {
    const rows = (await (await app.request('/api/printers?near=2000', authed(viewer))).json()) as Array<{ id: string; km: number | null }>
    const mine = rows.filter((r) => Object.values(printerIds).includes(r.id))
    expect(mine.map((r) => r.id).slice(0, 2)).toEqual([printerIds.near, printerIds.far])
    expect(mine[0].km).toBeLessThanOrEqual(6)
    expect(mine[1].km).toBeGreaterThan(700)
    expect(new Set(mine.slice(2).map((r) => r.id))).toEqual(new Set([printerIds.none, printerIds.unknown]))
    expect(mine.slice(2).map((r) => r.km)).toEqual([null, null])
  })
  it('says nothing about distance without near, and never sends the postcode', async () => {
    const rows = (await (await app.request('/api/printers', authed(viewer))).json()) as Array<Record<string, unknown>>
    const row = rows.find((r) => r.id === printerIds.near)!
    expect(row.km).toBeNull()
    expect(row).not.toHaveProperty('postcode')
  })
  it('shows a printer’s postcode to its owner only', async () => {
    const one = async (u: TestUser) => (await (await app.request(`/api/printers/${printerIds.near}`, authed(u))).json()) as Record<string, unknown>
    expect((await one(near)).postcode).toBe('2042')
    expect(await one(viewer)).not.toHaveProperty('postcode')
    const mine = (await (await app.request('/api/printers/mine', authed(near))).json()) as Array<Record<string, unknown>>
    expect(mine.find((r) => r.id === printerIds.near)!.postcode).toBe('2042')
  })
  it('R01 drops everything beyond the radius, and anything with no distance', async () => {
    const rows = (await (await app.request('/api/printers?near=2000&within=10', authed(viewer))).json()) as Array<{ id: string }>
    const ids = rows.map((r) => r.id)
    expect(ids).toContain(printerIds.near)
    expect(ids).not.toContain(printerIds.far)
    expect(ids).not.toContain(printerIds.none)
    expect(ids).not.toContain(printerIds.unknown)
  })
  it('refuses a near that is not a postcode, and a radius that is not whole km', async () => {
    expect((await app.request('/api/printers?near=Newtown', authed(viewer))).status).toBe(400)
    expect((await app.request('/api/printers?near=2000&within=0', authed(viewer))).status).toBe(400)
  })
  it('saves a printer’s postcode, and refuses one that is not four digits', async () => {
    const patch = (postcode: string) =>
      app.request(`/api/printers/${printerIds.near}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${near.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ postcode }),
      })
    expect((await patch('20 42')).status).toBe(400)
    const saved = await patch('2042')
    expect(saved.status).toBe(200)
    expect(((await saved.json()) as { postcode: string }).postcode).toBe('2042')
  })
  it('takes a postcode when a printer is added, and none for empty', async () => {
    const add = (postcode: string) =>
      app.request('/api/printers', {
        method: 'POST',
        headers: { Authorization: `Bearer ${far.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Added', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200, postcode }),
      })
    expect((await add('NSW')).status).toBe(400)
    const withOne = (await (await add('3000')).json()) as { id: string; postcode: string | null }
    const withNone = (await (await add('')).json()) as { id: string; postcode: string | null }
    printerIds.added = withOne.id
    printerIds.addedNone = withNone.id
    expect(withOne.postcode).toBe('3000')
    expect(withNone.postcode).toBeNull()
  })
})

describe('the public lists', () => {
  it('Y01 gives a toy its owner’s distance, never their postcode', async () => {
    const rows = (await (await app.request('/api/public/toys?near=2000&within=10', authed(viewer))).json()) as Array<Record<string, unknown>>
    const row = rows.find((r) => r.id === toyId)!
    expect(row.km).toBeLessThanOrEqual(6)
    expect(JSON.stringify(row)).not.toContain('2042')
  })
  it('gives an organisation its distance, and drops it outside the radius', async () => {
    const rows = (await (await app.request('/api/public/organizations?near=2000', authed(viewer))).json()) as Array<{ id: string; km: number | null }>
    expect(rows.find((r) => r.id === orgId)!.km).toBeGreaterThan(700)
    const inside = (await (await app.request('/api/public/organizations?near=2000&within=10', authed(viewer))).json()) as Array<{ id: string }>
    expect(inside.map((r) => r.id)).not.toContain(orgId)
  })
  it('measures nothing for a signed-out caller, and ignores their radius', async () => {
    const toys = (await (await app.request('/api/public/toys?near=3000&within=10')).json()) as Array<{ id: string; km: number | null }>
    expect(toys.find((r) => r.id === toyId)!.km).toBeNull()
    const orgs = (await (await app.request('/api/public/organizations?near=2000&within=10')).json()) as Array<{ id: string; km: number | null }>
    expect(orgs.find((r) => r.id === orgId)!.km).toBeNull()
  })
  it('refuses a near that is not a postcode, signed in or not', async () => {
    expect((await app.request('/api/public/toys?near=Newtown')).status).toBe(400)
    expect((await app.request('/api/public/organizations?near=2000&within=ten', authed(viewer))).status).toBe(400)
  })
})

describe('Makers wanted', () => {
  it('measures from the family’s profile postcode, and shows the maker only the km', async () => {
    const res = await app.request('/api/toy-transactions/build', {
      method: 'POST',
      headers: { Authorization: `Bearer ${family.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ tutorial_id: tutorialId, build_brief: 'Please.', requester_suburb: 'Newtown', travel_km: 10 }),
    })
    expect(res.status).toBe(201)
    const created = await res.json()
    buildId = (created as { id: string }).id
    expect(JSON.stringify(created)).not.toContain('2042')
    const body = await (await app.request('/api/toy-transactions/open-builds?near=2000', authed(viewer))).text()
    const row = (JSON.parse(body) as Array<Record<string, unknown>>).find((r) => r.tutorial_id === tutorialId)!
    expect(row.km).toBeLessThanOrEqual(6)
    expect(body).not.toContain('2042')
  })
  it('keeps the postcode out of every toy-transactions answer, the family’s own included', async () => {
    for (const u of [viewer, family]) {
      const one = await (await app.request(`/api/toy-transactions/${buildId}`, authed(u))).text()
      expect(JSON.parse(one).id).toBe(buildId)
      expect(one).not.toContain('2042')
      expect(await (await app.request('/api/toy-transactions', authed(u))).text()).not.toContain('2042')
    }
  })
  it('stores no postcode on the request: a member selecting one is refused', async () => {
    const { error } = await createUserClient(viewer.token).from('toy_transactions').select('requester_postcode').eq('id', buildId)
    expect(error?.code).toBe('42703') // undefined_column
  })
})
