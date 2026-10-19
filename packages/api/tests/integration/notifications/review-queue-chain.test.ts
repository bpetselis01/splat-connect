/**
 * The review queue's inbox rows: an author asking an organisation to back a
 * guide (backing_requested -> its leaders), and an author handing a guide over
 * for review (tutorial_submitted -> the leaders of the organisations that
 * accepted, or every admin when none did). tutorial_id is the link target;
 * mobile opens both on the organisation hub, where the queue is.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader, acceptTerms, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'
import { nameUser } from '../../helpers/notifications.js'

let author: TestUser
let leader: TestUser
let admin: TestUser
let orgId: string
const projects: string[] = []

const authed = (token: string, init: RequestInit = {}) => ({
  ...init,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers ?? {}) },
})
const notesFor = async (recipient: string, tutorialId: string, type: string) =>
  (
    await adminClient()
      .from('notifications')
      .select('recipient_id, type, tutorial_id, tutorial_title, actor_name')
      .eq('recipient_id', recipient)
      .eq('tutorial_id', tutorialId)
      .eq('type', type)
  ).data ?? []

async function project(status: 'draft' | 'pending' | 'approved' | 'rejected', backed: boolean) {
  const id = await createProject({ authorId: author.id, status, title: 'Queue Fixture' })
  projects.push(id)
  if (backed) await requestBacking({ tutorialId: id, orgId, status: 'accepted' })
  return id
}
/** The editor's save: the whole form again, with the status it wants. */
async function submit(id: string, token = author.token) {
  const { data } = await adminClient().from('tutorials').select('updated_at').eq('id', id).single()
  return app.request(`/api/tutorials/${id}`, authed(token, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'pending', safety_declared: true, build_minutes: 30, updated_at: data!.updated_at }),
  }))
}

beforeAll(async () => {
  ;[author, leader, admin] = await Promise.all([
    createTestUser('contributor'),
    createTestUser('contributor'),
    createTestUser('admin'),
  ])
  await nameUser(author.id, 'Ada Author')
  await acceptTerms(author.id, 'contributor_terms')
  orgId = await createOrg({ createdBy: leader.id, name: 'Riverside Therapy' })
  await addLeader(orgId, leader.id)
})

afterAll(async () => {
  await cleanupOrg(orgId, projects)
  await Promise.all([author, leader, admin].map((u) => deleteTestUser(u.id)))
})

describe('asking an organisation to back a guide (T18)', () => {
  it('T18 tells its leader once, naming the guide and the author; asking again tells nobody', async () => {
    const id = await project('draft', false)
    const ask = () => app.request(`/api/tutorials/${id}/orgs`, authed(author.token, { method: 'POST', body: JSON.stringify({ org_id: orgId }) }))
    expect((await ask()).status).toBe(201)
    expect(await notesFor(leader.id, id, 'backing_requested')).toEqual([
      { recipient_id: leader.id, type: 'backing_requested', tutorial_id: id, tutorial_title: 'Queue Fixture', actor_name: 'Ada Author' },
    ])
    expect((await ask()).status).toBe(200)
    expect(await notesFor(leader.id, id, 'backing_requested')).toHaveLength(1)
    expect(await notesFor(author.id, id, 'backing_requested')).toEqual([])
  })
})

describe('handing a guide over for review (T05, T22)', () => {
  it('T05 a backed guide tells the backing organisation’s leader, not the admins', async () => {
    const id = await project('draft', true)
    expect((await submit(id)).status).toBe(200)
    expect(await notesFor(leader.id, id, 'tutorial_submitted')).toEqual([
      { recipient_id: leader.id, type: 'tutorial_submitted', tutorial_id: id, tutorial_title: 'Queue Fixture', actor_name: 'Ada Author' },
    ])
    expect(await notesFor(admin.id, id, 'tutorial_submitted')).toEqual([])
  })

  it('T05 an unbacked guide tells every admin', async () => {
    const id = await project('draft', false)
    expect((await submit(id)).status).toBe(200)
    expect(await notesFor(admin.id, id, 'tutorial_submitted')).toEqual([
      { recipient_id: admin.id, type: 'tutorial_submitted', tutorial_id: id, tutorial_title: 'Queue Fixture', actor_name: 'Ada Author' },
    ])
    expect(await notesFor(leader.id, id, 'tutorial_submitted')).toEqual([])
  })

  it('saving a guide that is already pending tells nobody again', async () => {
    const id = await project('draft', true)
    await submit(id)
    expect((await submit(id)).status).toBe(200)
    expect(await notesFor(leader.id, id, 'tutorial_submitted')).toHaveLength(1)
  })

  it.each(['rejected', 'approved'] as const)('T22 resubmitting a %s guide tells the leader again (T22)', async (before) => {
    const id = await project(before, true)
    expect((await submit(id)).status).toBe(200)
    const { data } = await adminClient().from('tutorials').select('status').eq('id', id).single()
    expect(data!.status).toBe('pending')
    expect(await notesFor(leader.id, id, 'tutorial_submitted')).toEqual([
      { recipient_id: leader.id, type: 'tutorial_submitted', tutorial_id: id, tutorial_title: 'Queue Fixture', actor_name: 'Ada Author' },
    ])
  })
})
