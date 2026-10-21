/**
 * The public event list and calendar feed with more events and hosts than fit
 * in one PostgREST URL (~300 uuids). The lookups for host names and "asks a
 * question" used to fail with 414 and fall back to defaults, so every card
 * read "I'm going" with no form and every feed entry named no host.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { adminClient, createTestUser, deleteTestUser, type TestUser } from '../../helpers/auth.js'

const COUNT = 350
const tag = `Many Org ${Date.now()}`
let host: TestUser
let orgIds: string[] = []
let eventIds: string[] = []

beforeAll(async () => {
  host = await createTestUser('contributor')
  const admin = adminClient()
  const { data: orgs, error: orgErr } = await admin
    .from('organizations')
    .insert(Array.from({ length: COUNT }, (_, i) => ({ name: `${tag} ${i}`, status: 'active', suburb: 'Crows Nest', state: 'NSW' })))
    .select('id, name')
  if (orgErr) throw orgErr
  orgIds = orgs!.map((o) => o.id)
  const { data: events, error: evErr } = await admin
    .from('org_events')
    .insert(
      orgs!.map((o) => ({
        org_id: o.id,
        kind: 'workshop',
        title: `Many event ${o.name}`,
        starts_at: new Date(Date.now() + 14 * 864e5).toISOString(),
        format: 'in_person',
        location: 'A hall',
        suburb: 'Crows Nest',
        state: 'NSW',
        status: 'published',
        created_by: host.id,
      })),
    )
    .select('id, title')
  if (evErr) throw evErr
  eventIds = events!.map((e) => e.id)
  const { error: qErr } = await admin
    .from('org_event_questions')
    .insert({ event_id: eventIds[0], position: 1, prompt: 'How many?', answer_type: 'number', required: true })
  if (qErr) throw qErr
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('org_event_questions').delete().in('event_id', eventIds.slice(0, 1))
  await admin.from('org_events').delete().in('org_id', orgIds.slice(0, 100))
  for (let i = 100; i < orgIds.length; i += 100) await admin.from('org_events').delete().in('org_id', orgIds.slice(i, i + 100))
  for (let i = 0; i < orgIds.length; i += 100) await admin.from('organizations').delete().in('id', orgIds.slice(i, i + 100))
  await deleteTestUser(host.id)
})

describe('more than 300 published events', () => {
  it('lists host names and has_questions for each', async () => {
    const res = await app.request('/api/public/events')
    expect(res.status).toBe(200)
    const rows = (await res.json()) as Array<{ id: string; org_name: string; has_questions: boolean }>
    const first = rows.find((r) => r.id === eventIds[0])!
    expect(first.has_questions).toBe(true)
    expect(first.org_name).toBe(`${tag} 0`)
    const last = rows.find((r) => r.id === eventIds[COUNT - 1])!
    expect(last.has_questions).toBe(false)
    expect(last.org_name).toBe(`${tag} ${COUNT - 1}`)
  })
})
