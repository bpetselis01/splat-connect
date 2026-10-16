import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import app from '../../../src/app.js'

let reporter: TestUser
let admin: TestUser
let reportId: string

const patch = (body: Record<string, unknown>) =>
  app.request(`/api/admin/member-reports/${reportId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })

const notices = async () =>
  (await adminClient().from('notifications').select('type, actor_name, member_report_id').eq('recipient_id', reporter.id)).data ?? []

beforeAll(async () => {
  reporter = await createTestUser('contributor')
  admin = await createTestUser('admin')
  const { data } = await adminClient()
    .from('member_reports')
    .insert({ reporter_id: reporter.id, subject_kind: 'toy', subject_label: 'Drum', category: 'other', body: 'Loose skin.' })
    .select('id')
    .single()
  reportId = data!.id
})

afterAll(async () => {
  await Promise.all([reporter, admin].map((u) => deleteTestUser(u.id)))
})

describe('PATCH /api/admin/member-reports/:id notifies the reporter', () => {
  it('sends nothing for "looking" or a note', async () => {
    expect((await patch({ status: 'looking', note_to_reporter: 'On it.' })).status).toBe(200)
    expect(await notices()).toEqual([])
  })

  it('sends one report_resolved, signed SPLAT, on the move to resolved', async () => {
    expect((await patch({ status: 'resolved' })).status).toBe(200)
    expect(await notices()).toEqual([{ type: 'report_resolved', actor_name: 'SPLAT', member_report_id: reportId }])
  })

  it('sends nothing when it is saved again while resolved', async () => {
    expect((await patch({ status: 'resolved', note_to_reporter: 'Fixed.' })).status).toBe(200)
    expect(await notices()).toHaveLength(1)
  })
})
