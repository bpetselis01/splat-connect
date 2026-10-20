/** admin-counts: the board's six numbers in one admin-only call. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let admin: TestUser
let member: TestUser

const counts = async (token: string) => app.request('/api/admin/counts', { headers: { Authorization: `Bearer ${token}` } })

beforeAll(async () => {
  ;[admin, member] = await Promise.all([createTestUser('admin'), createTestUser()])
})

afterAll(async () => {
  await adminClient().from('member_reports').delete().eq('reporter_id', member.id)
  await Promise.all([admin, member].map((u) => deleteTestUser(u.id)))
})

describe('GET /api/admin/counts', () => {
  it('is admin only', async () => {
    expect((await counts(member.token)).status).toBe(403)
  })

  it('Q17 WM01 counts an open member report under reports, and returns all six', async () => {
    const before = (await (await counts(admin.token)).json()) as Record<string, number>
    expect(Object.keys(before).sort()).toEqual(['accounts', 'ideas', 'organisations', 'reports', 'spotCheck', 'tutorials'])
    await adminClient().from('member_reports').insert({
      reporter_id: member.id, subject_kind: 'toy', subject_label: 'Drum', category: 'other', body: 'x',
    })
    const after = (await (await counts(admin.token)).json()) as Record<string, number>
    expect(after.reports).toBe(before.reports + 1)
    expect(after.spotCheck).toBeLessThanOrEqual(10)
  })
})
