import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let user: TestUser
let toyId: string

function uploadRequest(path: string, token: string, file: File) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('toyId', toyId)
  return app.request(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
}

beforeAll(async () => {
  user = await createTestUser('contributor')
  const res = await app.request('/api/toys', {
    method: 'POST',
    headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Robot', condition: 7 }),
  })
  const toy = (await res.json()) as { id: string }
  toyId = toy.id
})

afterAll(async () => {
  const admin = adminClient()
  const { data: files } = await admin.storage.from('toy-photos-library').list(toyId)
  if (files?.length)
    await admin.storage.from('toy-photos-library').remove(files.map((f) => `${toyId}/${f.name}`))
  await admin.from('toys').delete().eq('id', toyId)
  await deleteTestUser(user.id)
})

describe('toy photo uploads', () => {
  it('replacing a cover photo deletes the old cover, leaving switch photos untouched', async () => {
    const switchRes = await uploadRequest(
      '/api/upload/toy-switch-photo',
      user.token,
      new File(['switch-bytes'], 'switch.jpg', { type: 'image/jpeg' })
    )
    expect(switchRes.status).toBe(200)

    const first = await uploadRequest(
      '/api/upload/toy-cover',
      user.token,
      new File(['jpg-bytes'], 'cover.jpg', { type: 'image/jpeg' })
    )
    expect(first.status).toBe(200)

    const second = await uploadRequest(
      '/api/upload/toy-cover',
      user.token,
      new File(['png-bytes'], 'cover.png', { type: 'image/png' })
    )
    expect(second.status).toBe(200)

    const { data: files } = await adminClient().storage.from('toy-photos-library').list(toyId)
    const covers = files?.filter((f) => f.name.startsWith('cover.')) ?? []
    expect(covers.length).toBe(1)
    expect(covers[0].name).toBe('cover.png')
    expect(files?.some((f) => f.name.startsWith('switch-'))).toBe(true)
  })

  it('uploads multiple switch photos as a gallery instead of replacing', async () => {
    const before = await adminClient().storage.from('toy-photos-library').list(toyId)
    const beforeCount = before.data?.filter((f) => f.name.startsWith('switch-')).length ?? 0

    const first = await uploadRequest(
      '/api/upload/toy-switch-photo',
      user.token,
      new File(['a'], 'a.jpg', { type: 'image/jpeg' })
    )
    const second = await uploadRequest(
      '/api/upload/toy-switch-photo',
      user.token,
      new File(['b'], 'b.jpg', { type: 'image/jpeg' })
    )
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)

    const { data: files } = await adminClient().storage.from('toy-photos-library').list(toyId)
    const afterCount = files?.filter((f) => f.name.startsWith('switch-')).length ?? 0
    expect(afterCount).toBe(beforeCount + 2)
  })

  it('rejects a photo upload for a toy the caller does not own', async () => {
    const other = await createTestUser('contributor')
    const fd = new FormData()
    fd.append('file', new File(['x'], 'cover.jpg', { type: 'image/jpeg' }))
    fd.append('toyId', toyId)
    const res = await app.request('/api/upload/toy-cover', {
      method: 'POST',
      headers: { Authorization: `Bearer ${other.token}` },
      body: fd,
    })
    expect(res.status).toBe(404)
    await deleteTestUser(other.id)
  })
})
