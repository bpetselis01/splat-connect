import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { VERIFIED_MIN_JOBS } from '@splat-connect/types'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

/**
 * Hand-offs: an admin does something on the WEB (review an idea, pass a test
 * print) and these read back what the MOBILE endpoints then say. Mobile has no
 * admin screen for either, so the web action is the only setter.
 */
let author: TestUser
let staff: TestUser
let owner: TestUser
let family: TestUser
let printerId: string
let tutorialId: string
const ideaIds: string[] = []
const bearer = (u: TestUser) => ({ Authorization: `Bearer ${u.token}`, 'Content-Type': 'application/json' })
const get = async <T>(path: string, u?: TestUser) =>
  (await (await app.request(path, u ? { headers: bearer(u) } : {})).json()) as T
const send = (path: string, u: TestUser, method: string, body?: unknown) =>
  app.request(path, { method, headers: bearer(u), ...(body ? { body: JSON.stringify(body) } : {}) })
type Idea = { id: string; status: string; review_note: string | null; tutorial_id?: string | null }
const mineIdeas = async () => (await get<Idea[]>('/api/ideas/mine', author))
const submit = async (title: string) => {
  const res = await send('/api/ideas', author, 'POST', { title, summary: 'A switch toy.' })
  expect(res.status).toBe(201)
  const id = ((await res.json()) as { id: string }).id
  ideaIds.push(id)
  return id
}

beforeAll(async () => {
  ;[author, staff, owner, family] = await Promise.all([
    createTestUser('contributor'),
    createTestUser('admin'),
    createTestUser('contributor'),
    createTestUser('contributor'),
  ])
  const admin = adminClient()
  const { data: t } = await admin
    .from('tutorials')
    .insert({ title: 'Hand-off fixture', description: 'x', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = t!.id
  const { data: p } = await admin
    .from('printers')
    .insert({ owner_id: owner.id, name: 'Hand-off printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200 })
    .select('id')
    .single()
  printerId = p!.id
})

afterAll(async () => {
  const admin = adminClient()
  const { data: files } = await admin.storage.from('printer-test-prints').list(printerId)
  if (files?.length) await admin.storage.from('printer-test-prints').remove(files.map((f) => `${printerId}/${f.name}`))
  const { data: graduated } = await admin.from('toy_ideas').select('tutorial_id').in('id', ideaIds)
  await admin.from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await admin.from('printers').delete().eq('id', printerId)
  await admin.from('toy_ideas').delete().in('id', ideaIds)
  await admin.from('tutorials').delete().in('id', [tutorialId, ...(graduated ?? []).map((g) => g.tutorial_id).filter(Boolean)])
  await Promise.all([author, staff, owner, family].map((u) => deleteTestUser(u.id)))
})

describe('an idea reviewed on the web, as the phone reads it', () => {
  it('C12/C01 WI11: pending until approved, then on /ideas/mine and the public challenge list, with a notification', async () => {
    const id = await submit('Approved idea')
    expect((await mineIdeas()).find((i) => i.id === id)!.status).toBe('pending')
    expect((await get<Idea[]>('/api/public/challenges')).some((i) => i.id === id)).toBe(false)

    expect((await send(`/api/admin/ideas/${id}/status`, staff, 'PATCH', { status: 'challenge' })).status).toBe(200)

    expect((await mineIdeas()).find((i) => i.id === id)!.status).toBe('challenge')
    expect((await get<Idea[]>('/api/public/challenges')).some((i) => i.id === id)).toBe(true)
    const inbox = await get<{ type: string; idea_id: string }[]>('/api/notifications/me', author)
    expect(inbox.some((n) => n.type === 'idea_approved' && n.idea_id === id)).toBe(true)
  })

  it('C12: a rejection reaches the author with its note and never reaches the public list', async () => {
    const id = await submit('Rejected idea')
    await send(`/api/admin/ideas/${id}/status`, staff, 'PATCH', { status: 'rejected', review_note: 'Too broad.' })

    expect((await mineIdeas()).find((i) => i.id === id)).toMatchObject({ status: 'rejected', review_note: 'Too broad.' })
    expect((await get<Idea[]>('/api/public/challenges')).some((i) => i.id === id)).toBe(false)
    const inbox = await get<{ type: string; idea_id: string }[]>('/api/notifications/me', author)
    expect(inbox.some((n) => n.type === 'idea_rejected' && n.idea_id === id)).toBe(true)
  })

  it('C10 WM14: a graduated challenge points the phone at its write-up', async () => {
    const id = await submit('Graduating idea')
    await send(`/api/admin/ideas/${id}/status`, staff, 'PATCH', { status: 'challenge' })
    const res = await send(`/api/admin/ideas/${id}/graduate`, staff, 'POST')
    expect(res.status).toBe(201)
    const { tutorial_id } = (await res.json()) as { tutorial_id: string }

    const row = (await get<Idea[]>('/api/public/challenges')).find((i) => i.id === id)!
    expect(row.status).toBe('graduated')
    expect((await mineIdeas()).find((i) => i.id === id)).toMatchObject({ status: 'graduated', tutorial_id })
    const inbox = await get<{ type: string; idea_id: string }[]>('/api/notifications/me', author)
    expect(inbox.some((n) => n.type === 'idea_graduated' && n.idea_id === id)).toBe(true)
  })
})

describe('a printer verified on the web, as the phone reads it', () => {
  const shield = async () =>
    (await get<{ id: string; verified: boolean }[]>('/api/printers', family)).find((p) => p.id === printerId)!.verified

  it('R15 R01 WM34: the shield appears on the finder only after a passed test print and enough finished jobs', async () => {
    const form = new FormData()
    form.append('file', new File([new Uint8Array([1, 2, 3])], 'benchy.png', { type: 'image/png' }))
    const submitted = await app.request(`/api/printers/${printerId}/test-prints`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${owner.token}` },
      body: form,
    })
    expect(submitted.status).toBe(201)
    expect(await shield()).toBe(false)

    const queue = await get<{ id: string; printer_id: string }[]>('/api/admin/test-prints', staff)
    const entry = queue.find((t) => t.printer_id === printerId)!
    expect((await send(`/api/admin/test-prints/${entry.id}`, staff, 'PATCH', { verdict: 'pass', note: 'Clean layers.' })).status).toBe(200)

    const mine = await get<{ id: string; test_print: { verdict: string; note: string } }[]>('/api/printers/mine', owner)
    expect(mine.find((p) => p.id === printerId)!.test_print).toMatchObject({ verdict: 'pass', note: 'Clean layers.' })
    // Passed, but verified is earned: the jobs are still short.
    expect(await shield()).toBe(false)

    await adminClient()
      .from('toy_transactions')
      .insert(
        Array.from({ length: VERIFIED_MIN_JOBS }, () => ({
          type: 'print', status: 'completed', tutorial_id: tutorialId, printer_id: printerId,
          requester_id: family.id, owner_id: owner.id, print_group_id: crypto.randomUUID(),
        }))
      )
    expect(await shield()).toBe(true)
  })
})
