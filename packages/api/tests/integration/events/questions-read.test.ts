// journeys: (none — route coverage; no journey row names this route yet)
/**
 * GET /api/organizations/:orgId/events/:id/questions returns an event's
 * registration questions in order. A published event's form is public to any
 * signed-in member; a draft's is the leaders' alone.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { addLeader, createOrg } from '../../helpers/orgs.js'

let leader: TestUser
let member: TestUser
let orgId: string
let published: string
let draft: string

const read = (event: string, token: string) => app.request(`/api/organizations/${orgId}/events/${event}/questions`, { headers: { Authorization: `Bearer ${token}` } })
const asked = async (res: Response) => ((await res.json()) as Array<{ position: number; prompt: string; answer_type: string; required: boolean }>).map((q) => [q.position, q.prompt, q.answer_type, q.required])

beforeAll(async () => {
  ;[leader, member] = await Promise.all([createTestUser('contributor'), createTestUser('contributor')])
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  const sb = adminClient()
  const event = async (status: string) => {
    const { data, error } = await sb
      .from('org_events')
      .insert({ org_id: orgId, kind: 'workshop', title: `${status} event`, starts_at: new Date(Date.now() + 864e5).toISOString(), format: 'in_person', location: 'A hall', suburb: 'Crows Nest', state: 'NSW', status, created_by: leader.id })
      .select('id')
      .single()
    if (error) throw new Error(error.message)
    await sb.from('org_event_questions').insert([
      { event_id: data.id, position: 2, prompt: 'Anything else?', answer_type: 'paragraph', required: false },
      { event_id: data.id, position: 1, prompt: 'How many are coming?', answer_type: 'number', required: true },
    ])
    return data.id as string
  }
  published = await event('published')
  draft = await event('draft')
})
afterAll(async () => {
  await adminClient().from('organizations').delete().eq('id', orgId)
  for (const u of [leader, member]) await deleteTestUser(u.id)
})

describe('reading an event’s registration questions', () => {
  it('lists a published event’s questions in position order for any member', async () => {
    const res = await read(published, member.token)
    expect(res.status).toBe(200)
    expect(await asked(res)).toEqual([
      [1, 'How many are coming?', 'number', true],
      [2, 'Anything else?', 'paragraph', false],
    ])
  })

  it('shows a draft’s questions to its leader and an empty list to everyone else', async () => {
    expect(await asked(await read(draft, leader.token))).toEqual([
      [1, 'How many are coming?', 'number', true],
      [2, 'Anything else?', 'paragraph', false],
    ])
    expect(await (await read(draft, member.token)).json()).toEqual([])
  })

  it('gives an unknown event an empty list', async () => {
    expect(await (await read(crypto.randomUUID(), member.token)).json()).toEqual([])
  })
})
