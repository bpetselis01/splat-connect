/**
 * "Report this listing" on a toy files a member report in the reporter's name
 * and tells the toy's holder nothing.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let reporter: TestUser
let holder: TestUser
let toyId: string

beforeAll(async () => {
  reporter = await createTestUser('contributor')
  holder = await createTestUser('contributor')
  const { data } = await adminClient()
    .from('toys')
    .insert({ owner_id: holder.id, name: 'Drum', condition: 8, photo_urls: ['https://example.com/d.jpg'], offer_type: 'donation', status: 'published' })
    .select('id')
    .single()
  toyId = data!.id
})

afterAll(async () => {
  await adminClient().from('toys').delete().eq('id', toyId)
  await Promise.all([reporter, holder].map((u) => deleteTestUser(u.id)))
})

describe('POST /api/reports about a toy', () => {
  it('WY09 files the report as the caller, keeps the toy as its subject, and sends the holder nothing', async () => {
    const res = await app.request('/api/reports', {
      method: 'POST',
      headers: { Authorization: `Bearer ${reporter.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subject_kind: 'toy',
        subject_id: toyId,
        subject_label: 'Drum',
        category: 'wrong_info',
        body: 'The photo shows a different drum.',
        ok_to_contact: true,
        reporter_id: holder.id,
      }),
    })
    expect(res.status).toBe(201)
    const filed = (await res.json()) as { reporter_id: string; subject_kind: string; subject_id: string; category: string; status: string }
    expect(filed).toMatchObject({ reporter_id: reporter.id, subject_kind: 'toy', subject_id: toyId, category: 'wrong_info', status: 'new' })

    const told = await adminClient().from('notifications').select('type').eq('recipient_id', holder.id)
    expect(told.data).toEqual([])
  })

  it('WY09 refuses a report that names no category', async () => {
    const res = await app.request('/api/reports', {
      method: 'POST',
      headers: { Authorization: `Bearer ${reporter.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject_kind: 'toy', subject_id: toyId, subject_label: 'Drum', body: 'x' }),
    })
    expect(res.status).toBe(400)
  })
})
