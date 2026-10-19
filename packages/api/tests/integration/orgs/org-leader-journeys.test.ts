/**
 * The organisation leader's phone screens through the real routes: the profile
 * editor's sections (each applied by "Save and publish"), the recycling intake
 * queue, the print orders and the request tabs, and a family's report of an
 * organisation page.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/client.js'
import { createOrg, addLeader, cleanupOrg, createProject } from '../../helpers/orgs.js'

let leader: TestUser
let family: TestUser
let outsider: TestUser
let orgId: string

const json = (token: string, method: string, body?: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})
const authed = (token: string) => ({ headers: { Authorization: `Bearer ${token}` } })
const orgRow = async (columns: string) => (await adminClient().from('organizations').select(columns).eq('id', orgId).single()).data as Record<string, any>
const publicPage = async () => (await (await app.request(`/api/public/organizations/${orgId}`)).json()) as Record<string, any>
const patchProfile = (body: unknown, token = leader.token) => app.request(`/api/organizations/${orgId}/profile`, json(token, 'PATCH', body))

beforeAll(async () => {
  ;[leader, family, outsider] = await Promise.all([createTestUser('contributor'), createTestUser('contributor'), createTestUser('contributor')])
  orgId = await createOrg({ createdBy: leader.id, name: `Leader journeys ${Date.now()}` })
  await addLeader(orgId, leader.id)
})

afterAll(async () => {
  const admin = adminClient()
  const { data: files } = await admin.storage.from('toy-photos').list(`orgs/${orgId}`)
  if (files?.length) await admin.storage.from('toy-photos').remove(files.map((f) => `orgs/${orgId}/${f.name}`))
  const { data: txs } = await admin.from('toy_transactions').select('id').eq('owner_org_id', orgId)
  const ids = (txs ?? []).map((t: { id: string }) => t.id)
  if (ids.length) {
    await admin.from('toy_transaction_messages').delete().in('transaction_id', ids)
    await admin.from('toy_transactions').delete().in('id', ids)
  }
  await admin.from('member_reports').delete().eq('reporter_id', family.id)
  await admin.from('printers').delete().eq('owner_org_id', orgId)
  await admin.from('recycling_dropoffs').delete().eq('org_id', orgId)
  await cleanupOrg(orgId)
  await admin.from('organizations').delete().eq('id', orgId)
  await Promise.all([leader, family, outsider].map((u) => deleteTestUser(u.id)))
})

describe('the profile editor sections', () => {
  const upload = (slot: 'logo' | 'cover') => {
    const fd = new FormData()
    fd.append('file', new File(['png-bytes'], `${slot}.png`, { type: 'image/png' }))
    fd.append('orgId', orgId)
    fd.append('slot', slot)
    return app.request('/api/upload/org-image', { method: 'POST', headers: { Authorization: `Bearer ${leader.token}` }, body: fd })
  }

  it('L38 uploading a logo and a cover stores each url on the organisation and shows it on the public page', async () => {
    const logo = (await (await upload('logo')).json()) as { url: string }
    const cover = (await (await upload('cover')).json()) as { url: string }
    expect(logo.url).toContain(`orgs/${orgId}/logo-`)
    expect(cover.url).toContain(`orgs/${orgId}/cover-`)
    expect(await orgRow('logo_url, cover_url')).toEqual({ logo_url: logo.url, cover_url: cover.url })
    expect(await publicPage()).toMatchObject({ logo_url: logo.url, cover_url: cover.url })
  })

  it('L39 removing a picture sets only that url to null, and a url can never be written here', async () => {
    const before = await orgRow('logo_url, cover_url')
    const res = await patchProfile({ logo_url: null })
    expect(res.status).toBe(200)
    expect(await orgRow('logo_url, cover_url')).toEqual({ logo_url: null, cover_url: before.cover_url })
    expect((await publicPage()).logo_url).toBeNull()

    const forged = await patchProfile({ cover_url: 'https://elsewhere.example/x.png' })
    expect(forged.status).toBe(400)
    expect(await forged.json()).toEqual({ error: 'cover_url can only be cleared here' })
    expect((await patchProfile({ cover_url: null })).status).toBe(200)
    expect((await orgRow('cover_url')).cover_url).toBeNull()
  })

  it('L40 saving doors keeps their title, line and target in order, and an edited list drops the removed door', async () => {
    const put = (doors: unknown) => app.request(`/api/organizations/${orgId}/doors`, json(leader.token, 'PUT', { doors }))
    const two = [
      { title: 'Borrow a toy', body: 'From the shelf.', target: 'toy_library' },
      { title: 'Message us', target: 'message' },
    ]
    expect((await put(two)).status).toBe(200)
    const stored = async () =>
      (await adminClient().from('org_doors').select('position, title, body, target').eq('org_id', orgId).order('position')).data
    expect(await stored()).toEqual([
      { position: 1, title: 'Borrow a toy', body: 'From the shelf.', target: 'toy_library' },
      { position: 2, title: 'Message us', body: null, target: 'message' },
    ])
    expect((await publicPage()).doors.map((d: { title: string }) => d.title)).toEqual(['Borrow a toy', 'Message us'])

    expect((await put([{ title: 'Message us today', body: 'Any question.', target: 'message' }])).status).toBe(200)
    expect(await stored()).toEqual([{ position: 1, title: 'Message us today', body: 'Any question.', target: 'message' }])
  })

  it('L41 saving rates stores each line and claiming flag, the cost note and the payment methods', async () => {
    const lines = [
      { description: 'PLA filament, per small part', amount_cents: 200, claiming: true },
      { description: 'Machine time', amount_cents: 800, claiming: false },
    ]
    expect((await app.request(`/api/organizations/${orgId}/rate-lines`, json(leader.token, 'PUT', { lines }))).status).toBe(200)
    expect((await patchProfile({ rate_note: 'Filament is the only real cost.', payment_methods: ['cash', 'payid'] })).status).toBe(200)

    const { data } = await adminClient().from('org_rate_lines').select('position, description, amount_cents, claiming').eq('org_id', orgId).order('position')
    expect(data).toEqual([
      { position: 1, description: 'PLA filament, per small part', amount_cents: 200, claiming: true },
      { position: 2, description: 'Machine time', amount_cents: 800, claiming: false },
    ])
    expect(await orgRow('rate_note, payment_methods')).toEqual({ rate_note: 'Filament is the only real cost.', payment_methods: ['cash', 'payid'] })
    expect(await publicPage()).toMatchObject({ rate_note: 'Filament is the only real cost.', payment_methods: ['cash', 'payid'] })

    const dropped = await app.request(`/api/organizations/${orgId}/rate-lines`, json(leader.token, 'PUT', { lines: [lines[1]] }))
    expect(dropped.status).toBe(200)
    const { data: left } = await adminClient().from('org_rate_lines').select('description').eq('org_id', orgId)
    expect(left).toEqual([{ description: 'Machine time' }])
  })

  it('L42 saving what you do stores the trimmed capability chips and the public page lists them', async () => {
    expect((await patchProfile({ capabilities: [' Print parts ', 'Repair toys'] })).status).toBe(200)
    expect((await orgRow('capabilities')).capabilities).toEqual(['Print parts', 'Repair toys'])
    expect((await publicPage()).capabilities).toEqual(['Print parts', 'Repair toys'])
    const bad = await patchProfile({ capabilities: ['ok', '  '] })
    expect(bad.status).toBe(400)
    expect(await bad.json()).toEqual({ error: 'capabilities must be a list of words' })
  })

  it('L43 saving recycling stores the materials and the how-to-bring note, which Book a drop-off reads', async () => {
    expect((await patchProfile({ recycling_materials: ['PLA', 'PETG'], recycling_note: 'Ring the side door.' })).status).toBe(200)
    expect(await orgRow('recycling_materials, recycling_note')).toEqual({ recycling_materials: ['PLA', 'PETG'], recycling_note: 'Ring the side door.' })

    const list = (await (await app.request('/api/organizations', authed(family.token))).json()) as Array<{ id: string; recycling_materials: string[]; recycling_note: string | null }>
    expect(list.find((o) => o.id === orgId)).toMatchObject({ recycling_materials: ['PLA', 'PETG'], recycling_note: 'Ring the side door.' })
  })

  it('an outsider changes none of it', async () => {
    expect((await patchProfile({ capabilities: ['Hijack'] }, outsider.token)).status).toBe(404)
    expect((await orgRow('capabilities')).capabilities).toEqual(['Print parts', 'Repair toys'])
  })
})

describe('the recycling intake queue', () => {
  let dropId: string

  it('L12 the leader reads the organisation and its intake list with each family name; a stranger gets no names', async () => {
    await adminClient().from('profiles').update({ name: 'Priya Nair' }).eq('id', family.id)
    const { data } = await adminClient().from('recycling_dropoffs')
      .insert({ org_id: orgId, contributor_id: family.id, material: 'PLA', estimated_grams: 3000, condition_declared: true, declaration_version: 1 })
      .select('id').single()
    dropId = data!.id

    const org = (await (await app.request(`/api/organizations/${orgId}`, authed(leader.token))).json()) as { id: string; recycling_materials: string[] }
    expect(org).toMatchObject({ id: orgId, recycling_materials: ['PLA', 'PETG'] })
    const rows = (await (await app.request(`/api/organizations/${orgId}/recycling`, authed(leader.token))).json()) as Array<Record<string, any>>
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ id: dropId, material: 'PLA', estimated_grams: 3000, status: 'booked', contributor_name: 'Priya Nair' })
    const seen = (await (await app.request(`/api/organizations/${orgId}/recycling`, authed(outsider.token))).json()) as unknown[]
    expect(seen).toEqual([])
  })

  it('L14 Contaminated turns the drop-off away: declined, decided by the leader, nothing credited, and final', async () => {
    const res = await app.request(`/api/organizations/${orgId}/recycling/${dropId}`, json(leader.token, 'PATCH', { status: 'declined' }))
    expect(res.status).toBe(200)
    const { data } = await adminClient().from('recycling_dropoffs').select('status, credit_grams, weighed_grams, decided_by').eq('id', dropId).single()
    expect(data).toEqual({ status: 'declined', credit_grams: null, weighed_grams: null, decided_by: leader.id })

    const again = await app.request(`/api/organizations/${orgId}/recycling/${dropId}`, json(leader.token, 'PATCH', { status: 'received', weighed_grams: 3000, credit_grams: 2000 }))
    expect(again.status).toBe(409)
    expect(await again.json()).toEqual({ error: 'This drop-off has already been decided and cannot be changed.' })
  })
})

describe('print orders and the request tabs', () => {
  let machineId: string
  let orderId: string

  it('L11 the leader sees the organisation machines with their open jobs and the order waiting; a stranger sees neither', async () => {
    const admin = adminClient()
    const { data: printer } = await admin.from('printers')
      .insert({ owner_org_id: orgId, name: 'Org bench', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 }).select('id').single()
    machineId = printer!.id
    const { data: t } = await admin.from('tutorials').insert({ title: 'Org order guide', description: 'x', difficulty: 'easy', status: 'approved' }).select('id').single()
    const { data: tx } = await admin.from('toy_transactions')
      .insert({ type: 'print', status: 'requested', tutorial_id: t!.id, printer_id: machineId, requester_id: family.id, owner_id: null, owner_org_id: orgId })
      .select('id').single()
    orderId = tx!.id

    const mine = (await (await app.request('/api/printers/mine', authed(leader.token))).json()) as Array<{ id: string; name: string; org_name: string | null }>
    expect(mine.find((p) => p.id === machineId)).toMatchObject({ name: 'Org bench', org_name: expect.stringContaining('Leader journeys') })
    const orders = (await (await app.request('/api/toy-transactions', authed(leader.token))).json()) as Array<{ id: string; status: string; owner_org_id: string }>
    expect(orders.find((o) => o.id === orderId)).toMatchObject({ status: 'requested', owner_org_id: orgId })

    expect(((await (await app.request('/api/printers/mine', authed(outsider.token))).json()) as Array<{ id: string }>).map((p) => p.id)).not.toContain(machineId)
    expect(((await (await app.request('/api/toy-transactions', authed(outsider.token))).json()) as Array<{ id: string }>).map((o) => o.id)).not.toContain(orderId)
    await admin.from('tutorials').delete().eq('id', t!.id)
  })

  it('L16 the requests tabs read the organisation side, and a decline moves the row out of the waiting set', async () => {
    const waiting = async (token: string) =>
      ((await (await app.request('/api/toy-transactions?role=owner', authed(token))).json()) as Array<{ id: string; status: string }>).filter((t) => t.status === 'requested').map((t) => t.id)
    expect(await waiting(leader.token)).toContain(orderId)
    expect(await waiting(outsider.token)).not.toContain(orderId)

    const res = await app.request(`/api/toy-transactions/${orderId}/reject`, json(leader.token, 'POST', { reason: 'Machine is down' }))
    expect(res.status).toBe(200)
    expect(await waiting(leader.token)).not.toContain(orderId)
  })
})

describe('reporting an organisation page', () => {
  it('P09 files an organisation report with the label, category and text, and keeps it as new', async () => {
    const res = await app.request('/api/reports', json(family.token, 'POST', {
      subject_kind: 'organisation', subject_id: orgId, subject_label: 'Leader journeys org', category: 'wrong_info',
      body: 'Wrong opening hours.', ok_to_contact: true,
    }))
    expect(res.status).toBe(201)
    const { data } = await adminClient().from('member_reports')
      .select('reporter_id, subject_kind, subject_id, subject_label, category, body, ok_to_contact, status').eq('reporter_id', family.id)
    expect(data).toEqual([{
      reporter_id: family.id, subject_kind: 'organisation', subject_id: orgId, subject_label: 'Leader journeys org',
      category: 'wrong_info', body: 'Wrong opening hours.', ok_to_contact: true, status: 'new',
    }])
  })
})

describe('opening a backed guide’s PDF', () => {
  it('L03 a signed-in leader gets a signed link that serves the stored PDF, and a signed-out caller does not', async () => {
    const guideId = await createProject({ authorId: family.id, status: 'pending' })
    const path = `${guideId}/tutorial.pdf`
    const admin = adminClient()
    await admin.storage.from('tutorial-pdfs').upload(path, new Blob(['%PDF-1.4 review']), { upsert: true, contentType: 'application/pdf' })
    try {
      const { data, error } = await createUserClient(leader.token).storage.from('tutorial-pdfs').createSignedUrl(path, 60)
      expect(error).toBeNull()
      expect(data!.signedUrl).toContain(`/storage/v1/object/sign/tutorial-pdfs/${path}`)
      const served = await fetch(data!.signedUrl)
      expect(served.status).toBe(200)
      expect(await served.text()).toBe('%PDF-1.4 review')

      const anon = await createUserClient('').storage.from('tutorial-pdfs').createSignedUrl(path, 60)
      expect(anon.data).toBeNull()
    } finally {
      await admin.storage.from('tutorial-pdfs').remove([path])
      await admin.from('tutorial_contributors').delete().eq('tutorial_id', guideId)
      await admin.from('tutorials').delete().eq('id', guideId)
    }
  })
})
