/**
 * "Events I'm going to" for a member registered for more events than fit in
 * one PostgREST URL (~300 uuids). The event lookup used to 414 and the list
 * came back empty with no error.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { adminClient, createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

const COUNT = 350
const tag = `Mine Many ${Date.now()}`
let member: TestUser
let orgId: string
let eventIds: string[] = []

beforeAll(async () => {
  member = await createTestUser('contributor')
  const admin = adminClient()
  const org = await admin.from('organizations').insert({ name: tag, status: 'active', suburb: 'Crows Nest', state: 'NSW' }).select('id').single()
  if (org.error) throw org.error
  orgId = org.data.id
  const events = await admin
    .from('org_events')
    .insert(
      Array.from({ length: COUNT }, (_, i) => ({
        org_id: orgId,
        kind: 'workshop',
        title: `${tag} event ${i}`,
        starts_at: new Date(Date.now() + (i + 1) * 864e5).toISOString(),
        format: 'in_person',
        location: 'A hall',
        suburb: 'Crows Nest',
        state: 'NSW',
        status: 'published',
        created_by: member.id,
      })),
    )
    .select('id')
  if (events.error) throw events.error
  eventIds = events.data.map((e) => e.id)
  const { error } = await admin
    .from('org_event_registrations')
    .insert(eventIds.map((event_id) => ({ event_id, user_id: member.id, name: 'A member', email: 'member@splat-test.local' })))
  if (error) throw error
})

afterAll(async () => {
  const admin = adminClient()
  for (let i = 0; i < COUNT; i += 100) {
    await admin.from('org_event_registrations').delete().in('event_id', eventIds.slice(i, i + 100))
    await admin.from('org_events').delete().in('id', eventIds.slice(i, i + 100))
  }
  await admin.from('organizations').delete().eq('id', orgId)
  await deleteTestUser(member.id)
})

describe('a member registered for more than 300 events', () => {
  it('lists every event with its host', async () => {
    const res = await app.request('/api/events/mine', { headers: { Authorization: `Bearer ${member.token}` } })
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ event: { id: string; title: string; org_name: string } }>
    expect(rows).toHaveLength(COUNT)
    const last = rows.find((r) => r.event.id === eventIds[COUNT - 1])!
    expect(last.event.title).toBe(`${tag} event ${COUNT - 1}`)
    expect(last.event.org_name).toBe(tag)
  })
})
