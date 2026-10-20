import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let reporter: TestUser
let subject: TestUser

beforeAll(async () => {
  reporter = await createTestUser('contributor')
  subject = await createTestUser('contributor')
})

afterAll(async () => {
  await adminClient().from('member_reports').delete().eq('reporter_id', reporter.id)
  await deleteTestUser(reporter.id)
  await deleteTestUser(subject.id)
})

describe('Report a problem on a showcase', () => {
  it('S03 stores a new person report naming the member, filed by the reporter', async () => {
    const res = await app.request('/api/reports', {
      method: 'POST',
      headers: { Authorization: `Bearer ${reporter.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ subject_kind: 'person', subject_id: subject.id, subject_label: 'Sam Taylor', category: 'conduct', body: 'Rude in the thread', ok_to_contact: true }),
    })
    expect(res.status).toBe(201)
    const { data } = await adminClient()
      .from('member_reports')
      .select('subject_kind, subject_id, subject_label, category, body, status, ok_to_contact')
      .eq('reporter_id', reporter.id)
    expect(data).toEqual([
      { subject_kind: 'person', subject_id: subject.id, subject_label: 'Sam Taylor', category: 'conduct', body: 'Rude in the thread', status: 'new', ok_to_contact: true },
    ])
  })
})
