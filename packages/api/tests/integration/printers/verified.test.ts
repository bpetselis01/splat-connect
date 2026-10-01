/**
 * 098. Verified is earned: the latest reviewed test print passed AND the
 * printer has VERIFIED_MIN_JOBS completed jobs. The owner submits a photo;
 * only an admin passes or fails it. The photo is a storage path pinned to the
 * printer's own folder, never a URL.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'
import { VERIFIED_MIN_JOBS } from '@splat-connect/types'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let owner: TestUser
let outsider: TestUser
let staff: TestUser
let family: TestUser
let tutorialId: string
let printerId: string
let otherPrinterId: string

const authed = (u: TestUser) => ({ headers: { Authorization: `Bearer ${u.token}` } })
const photo = (u: TestUser, type = 'image/png') => {
  const form = new FormData()
  form.append('file', new File([new Uint8Array([1, 2, 3])], '../../evil name.png', { type }))
  return { method: 'POST', headers: { Authorization: `Bearer ${u.token}` }, body: form }
}
const verified = async () =>
  ((await (await app.request(`/api/printers/${printerId}`, authed(family))).json()) as { verified: boolean }).verified
const completeJobs = (n: number) =>
  adminClient()
    .from('toy_transactions')
    .insert(
      Array.from({ length: n }, () => ({
        type: 'print', status: 'completed', tutorial_id: tutorialId, printer_id: printerId, requester_id: family.id,
        owner_id: owner.id, print_group_id: crypto.randomUUID(),
      }))
    )

beforeAll(async () => {
  owner = await createTestUser('contributor')
  outsider = await createTestUser('contributor')
  staff = await createTestUser('admin')
  family = await createTestUser('contributor')
  const admin = adminClient()
  const { data: t } = await admin
    .from('tutorials')
    .insert({ title: 'Verified fixture', description: 'x', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = t!.id
  const machine = async (owner_id: string) =>
    (
      await admin
        .from('printers')
        .insert({ owner_id, name: 'To verify', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 })
        .select('id')
        .single()
    ).data!.id as string
  printerId = await machine(owner.id)
  otherPrinterId = await machine(outsider.id)
})

afterAll(async () => {
  const admin = adminClient()
  const { data: files } = await admin.storage.from('printer-test-prints').list(printerId)
  if (files?.length) await admin.storage.from('printer-test-prints').remove(files.map((f) => `${printerId}/${f.name}`))
  await admin.from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await admin.from('printers').delete().in('id', [printerId, otherPrinterId])
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([owner, outsider, staff, family].map((u) => deleteTestUser(u.id)))
})

describe('098 verified printers', () => {
  it('selects its objects through the admin client', async () => {
    const { error } = await adminClient().from('printer_test_prints').select('id, photo_path').limit(1)
    expect(error).toBeNull()
    expect((await adminClient().storage.getBucket('printer-test-prints')).data?.public).toBe(false)
  })

  it('refuses a missing file or a non-image before anything is stored', async () => {
    const empty = { method: 'POST', headers: { Authorization: `Bearer ${owner.token}` }, body: new FormData() }
    expect((await app.request(`/api/printers/${printerId}/test-prints`, empty)).status).toBe(400)
    expect((await app.request(`/api/printers/${printerId}/test-prints`, photo(owner, 'text/html'))).status).toBe(400)
  })

  it('lets only the owner submit a test print, one at a time', async () => {
    expect((await app.request(`/api/printers/${printerId}/test-prints`, photo(outsider))).status).toBe(404)
    expect((await app.request('/api/printers/not-a-uuid/test-prints', photo(owner))).status).toBe(404)
    const res = await app.request(`/api/printers/${printerId}/test-prints`, photo(owner))
    expect(res.status).toBe(201)
    expect(Object.keys((await res.json()) as object).sort()).toEqual(['id', 'note', 'printer_id', 'submitted_at', 'verdict'])
    expect((await app.request(`/api/printers/${printerId}/test-prints`, photo(owner))).status).toBe(409)
    const mine = (await (await app.request('/api/printers/mine', authed(owner))).json()) as Array<{ id: string; test_print: { verdict: null } }>
    expect(mine.find((p) => p.id === printerId)!.test_print.verdict).toBeNull()
  })

  it('stores the path the server built, never the client filename', async () => {
    const { data } = await adminClient().from('printer_test_prints').select('photo_path').eq('printer_id', printerId).single()
    expect(data!.photo_path).toMatch(new RegExp(`^${printerId}/[0-9a-f-]{36}\\.png$`))
  })

  it('refuses a direct insert with another printer’s folder or a URL', async () => {
    for (const photo_path of [
      `${otherPrinterId}/${crypto.randomUUID()}.png`,
      `https://evil.example/${printerId}/${crypto.randomUUID()}.png`,
    ]) {
      const { error } = await adminClient().from('printer_test_prints').insert({ printer_id: printerId, photo_path })
      expect(error?.code).toBe('23514')
    }
  })

  it('lets only an admin pass it, with a note', async () => {
    const queue = (await (await app.request('/api/admin/test-prints', authed(staff))).json()) as Array<{ id: string; printer_id: string; photo: string | null }>
    const mineInQueue = queue.find((t) => t.printer_id === printerId)!
    expect(mineInQueue.photo).toMatch(/^http/)
    expect(mineInQueue).not.toHaveProperty('photo_path')
    const patch = (u: TestUser, body: unknown) =>
      app.request(`/api/admin/test-prints/${mineInQueue.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    expect((await patch(owner, { verdict: 'pass' })).status).toBe(403)
    expect((await patch(staff, { verdict: 'maybe' })).status).toBe(400)
    expect((await patch(staff, { verdict: 'pass', note: 'Clean layers.' })).status).toBe(200)
  })

  it(`is verified only once ${VERIFIED_MIN_JOBS} jobs are completed too`, async () => {
    await completeJobs(VERIFIED_MIN_JOBS - 1)
    expect(await verified()).toBe(false)
    await completeJobs(1)
    expect(await verified()).toBe(true)
  })

  it('keeps the table shut to the anon and user keys', async () => {
    const url = process.env.SUPABASE_URL ?? 'http://localhost:54321'
    const anon = createClient(url, process.env.SUPABASE_ANON_KEY ?? '')
    expect((await anon.from('printer_test_prints').select('id')).data ?? []).toEqual([])
    const user = createClient(url, process.env.SUPABASE_ANON_KEY ?? '', {
      global: { headers: { Authorization: `Bearer ${owner.token}` } },
    })
    expect((await user.from('printer_test_prints').select('id')).data ?? []).toEqual([])
    const { error } = await user
      .from('printer_test_prints')
      .insert({ printer_id: printerId, photo_path: `${printerId}/${crypto.randomUUID()}.png` })
    expect(error).not.toBeNull()
  })
})
