// journeys: T09
/**
 * POST and DELETE /api/tutorials/:id/stl-files replace and clear a Guide's STL
 * files. The seat is the Guide's contributor; RLS on stl_files refuses anyone
 * else. The route takes already-uploaded file URLs, so what it checks is the
 * list shape and the print settings, not a MIME type (that is /api/upload/stl).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let owner: TestUser
let other: TestUser
let guide: string

const call = (method: string, id: string, token: string, body?: unknown) =>
  app.request(`/api/tutorials/${id}/stl-files`, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })

const filenames = async (id: string) =>
  ((await adminClient().from('stl_files').select('filename').eq('tutorial_id', id).order('filename')).data ?? []).map(
    (r) => r.filename
  )

beforeAll(async () => {
  const admin = adminClient()
  ;[owner, other] = await Promise.all([createTestUser(), createTestUser()])
  guide = (await admin.from('tutorials').insert({ title: 'STL guide', difficulty: 'easy' }).select('id').single()).data!.id
  await admin.from('tutorial_contributors').insert({ tutorial_id: guide, profile_id: owner.id, role: 'primary' })
})

afterAll(async () => {
  await adminClient().from('tutorials').delete().eq('id', guide)
  await Promise.all([deleteTestUser(owner.id), deleteTestUser(other.id)])
})

describe('POST /api/tutorials/:id/stl-files', () => {
  it('the contributor replaces the whole list and the rows carry the settings', async () => {
    const first = await call('POST', guide, owner.token, {
      stl_files: [
        { filename: 'a.stl', file_url: `${guide}/a.stl`, material: 'PLA', print_minutes: 90 },
        { filename: 'b.stl', file_url: `${guide}/b.stl` },
      ],
    })
    expect(first.status).toBe(201)
    expect(await filenames(guide)).toEqual(['a.stl', 'b.stl'])

    const second = await call('POST', guide, owner.token, { stl_files: [{ filename: 'c.stl', file_url: `${guide}/c.stl` }] })
    expect(second.status).toBe(201)
    expect(await filenames(guide)).toEqual(['c.stl'])
  })

  it('refuses a body that is not a list, leaving the rows alone', async () => {
    const res = await call('POST', guide, owner.token, { stl_files: 'a.stl' })
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'stl_files must be a list' })
    expect(await filenames(guide)).toEqual(['c.stl'])
  })

  it('refuses another member with 403 and removes nothing', async () => {
    const res = await call('POST', guide, other.token, { stl_files: [{ filename: 'x.stl', file_url: `${guide}/x.stl` }] })
    expect(res.status).toBe(403)
    expect(await filenames(guide)).toEqual(['c.stl'])
  })

  // Current behaviour: the insert trips the tutorial_id foreign key, which the route reports as a 500, not a 404.
  it('answers 500 for a Guide that does not exist', async () => {
    const res = await call('POST', crypto.randomUUID(), owner.token, { stl_files: [{ filename: 'x.stl', file_url: 'x/x.stl' }] })
    expect(res.status).toBe(500)
    expect(await res.json()).toEqual({ error: 'insert or update on table "stl_files" violates foreign key constraint "stl_files_tutorial_id_fkey"' })
  })
})

describe('DELETE /api/tutorials/:id/stl-files', () => {
  it('another member gets 204 and the rows stay', async () => {
    const res = await call('DELETE', guide, other.token)
    expect(res.status).toBe(204)
    expect(await filenames(guide)).toEqual(['c.stl'])
  })

  it('the contributor clears the list', async () => {
    const res = await call('DELETE', guide, owner.token)
    expect(res.status).toBe(204)
    expect(await filenames(guide)).toEqual([])
  })

  it('an unknown Guide is a no-op 204', async () => {
    expect((await call('DELETE', crypto.randomUUID(), owner.token)).status).toBe(204)
  })
})
