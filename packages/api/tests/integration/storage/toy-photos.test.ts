import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { MAX_PHOTOS } from '@splat-connect/types'

let user: TestUser
let toyId: string

function uploadRequest(token: string, file: File, id: string = toyId) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('toyId', id)
  return app.request('/api/upload/toy-photo', {
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
  // Why:   a4359f7c made this route append-only. The route it replaced deleted
  //        every existing file first, so a toy could only ever hold one photo.
  // How:   uploads two photos and expects both to survive.
  it('appends each photo instead of replacing the last one', async () => {
    const first = await uploadRequest(
      user.token,
      new File(['jpg-bytes'], 'a.jpg', { type: 'image/jpeg' })
    )
    const second = await uploadRequest(
      user.token,
      new File(['png-bytes'], 'b.png', { type: 'image/png' })
    )
    expect(first.status).toBe(200)
    expect(second.status).toBe(200)

    const { data: files } = await adminClient().storage.from('toy-photos-library').list(toyId)
    expect(files?.length).toBe(2)
  })

  // Why:   the delete the old route performed WAS the cap. Removing it is what
  //        MAX_PHOTOS is for, and nothing else enforces it on this path.
  // How:   the guard counts toys.photo_urls, not objects in the bucket — the
  //        route uploads and the client PATCHes the array afterwards, so a test
  //        that only uploads can never reach the cap. Seed the array instead.
  it('refuses the photo past MAX_PHOTOS', async () => {
    const full = Array.from({ length: MAX_PHOTOS }, (_, i) => `https://example.invalid/${i}.jpg`)
    const { error: seedError } = await adminClient()
      .from('toys')
      .update({ photo_urls: full })
      .eq('id', toyId)
    expect(seedError).toBeNull()

    const overflow = await uploadRequest(
      user.token,
      new File(['too-many'], 'six.jpg', { type: 'image/jpeg' })
    )
    expect(overflow.status).toBe(400)
    expect(((await overflow.json()) as { error: string }).error).toContain(String(MAX_PHOTOS))

    await adminClient().from('toys').update({ photo_urls: [] }).eq('id', toyId)
  })

  it('rejects a photo upload for a toy the caller does not own', async () => {
    const other = await createTestUser('contributor')
    const fd = new FormData()
    fd.append('file', new File(['x'], 'cover.jpg', { type: 'image/jpeg' }))
    fd.append('toyId', toyId)
    const res = await app.request('/api/upload/toy-photo', {
      method: 'POST',
      headers: { Authorization: `Bearer ${other.token}` },
      body: fd,
    })
    expect(res.status).toBe(404)
    await deleteTestUser(other.id)
  })
})
