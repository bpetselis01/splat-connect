import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

const GHOST = '00000000-0000-4000-8000-00000000dead'
let author: TestUser
let parent: TestUser
let leaving: TestUser
let guide: string
let draft: string
const send = (method: string, path: string, token: string, body?: unknown) =>
  app.request(path, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
const stamp = async () => (await adminClient().from('tutorials').select('updated_at').eq('id', guide).single()).data!.updated_at

beforeAll(async () => {
  author = await createTestUser('contributor')
  parent = await createTestUser('contributor')
  leaving = await createTestUser('contributor')
  await adminClient().from('profiles').update({ name: 'Priya' }).eq('id', parent.id)
  guide = await createProject({ authorId: author.id, status: 'approved', title: 'Notes Fixture' })
  draft = await createProject({ authorId: author.id, status: 'draft', title: 'Notes Draft Fixture' })
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().in('id', [guide, draft])
  for (const u of [author, parent]) await deleteTestUser(u.id)
})

describe('093 tutorial_notes', () => {
  let noteId: string

  it('takes a note against a step, notifies the authors and leaves the guide’s token alone', async () => {
    const before = await stamp()
    const res = await send('POST', `/api/tutorials/${guide}/notes`, parent.token, { step_position: 2, body: 'Step 2 needs a second zip tie.' })
    expect(res.status).toBe(201)
    noteId = ((await res.json()) as { id: string }).id
    expect(await stamp()).toBe(before)
    const { data } = await adminClient().from('notifications').select('type, actor_name').eq('recipient_id', author.id).eq('tutorial_id', guide)
    expect(data).toEqual([{ type: 'tutorial_noted', actor_name: 'Priya' }])
  })

  it('serves notes publicly with names', async () => {
    const res = await app.request(`/api/public/tutorials/${guide}/notes`)
    const notes = (await res.json()) as { id: string; author_name: string; step_position: number; pinned_at: string | null }[]
    expect(notes).toEqual([expect.objectContaining({ id: noteId, author_name: 'Priya', step_position: 2, pinned_at: null })])
  })

  it('validates, and refuses a guide that is not published', async () => {
    expect((await send('POST', `/api/tutorials/${guide}/notes`, parent.token, { step_position: null, body: '   ' })).status).toBe(400)
    expect((await send('POST', `/api/tutorials/${guide}/notes`, parent.token, { step_position: 0, body: 'x' })).status).toBe(400)
    expect((await send('POST', `/api/tutorials/${guide}/notes`, parent.token, { step_position: null, body: 'x', photo_url: 'https://elsewhere.test/a.jpg' })).status).toBe(400)
    expect((await send('POST', `/api/tutorials/${draft}/notes`, parent.token, { step_position: null, body: 'x' })).status).toBe(404)
  })

  it('lets only a contributor pin, and pinning names who did it', async () => {
    expect((await send('POST', `/api/tutorials/${guide}/notes/${noteId}/pin`, parent.token)).status).toBe(403)
    expect((await send('POST', `/api/tutorials/${guide}/notes/${noteId}/pin`, author.token)).status).toBe(200)
    const notes = (await (await app.request(`/api/public/tutorials/${guide}/notes`)).json()) as { pinned_by: string; pinned_at: string | null }[]
    expect(notes[0].pinned_by).toBe(author.id)
    expect((await send('POST', `/api/tutorials/${guide}/notes/${noteId}/unpin`, author.token)).status).toBe(200)
  })

  it('lets only the note’s author delete it', async () => {
    expect((await send('DELETE', `/api/tutorials/${guide}/notes/${noteId}`, author.token)).status).toBe(404)
    expect((await send('DELETE', `/api/tutorials/${guide}/notes/${noteId}`, parent.token)).status).toBe(204)
  })

  it('moves a deleted member’s notes to the Deleted member placeholder', async () => {
    const res = await send('POST', `/api/tutorials/${guide}/notes`, leaving.token, { step_position: null, body: 'A missing step: test the switch first.' })
    const id = ((await res.json()) as { id: string }).id
    expect((await adminClient().rpc('delete_account', { uid: leaving.id, keep_credit: false })).error).toBeNull()
    const { data } = await adminClient().from('tutorial_notes').select('author_id').eq('id', id).single()
    expect(data!.author_id).toBe(GHOST)
  })
})
