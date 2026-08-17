/**
 * A leader uploading a photo for their organisation's stock.
 *
 * Worth its own file because the storage policies live in 022, nowhere near the
 * toy policies they mirror, and the failure is total rather than partial: no
 * cover photo means no publish, so an org's shelf would be permanently invisible.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader, createOrgToy, cleanupOrg } from '../../helpers/orgs.js'

let leader: TestUser
let outsider: TestUser
let orgId: string
let toyId: string

function uploadCover(token: string, id: string) {
  const fd = new FormData()
  fd.append('file', new File(['jpg-bytes'], 'cover.jpg', { type: 'image/jpeg' }))
  fd.append('toyId', id)
  return app.request('/api/upload/toy-cover', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
}

beforeAll(async () => {
  leader = await createTestUser('contributor')
  outsider = await createTestUser('contributor')
  orgId = await createOrg({ createdBy: leader.id, name: 'Photo Org' })
  await addLeader(orgId, leader.id)
  toyId = await createOrgToy({ orgId, quantity: 3, status: 'draft' })
})

afterAll(async () => {
  const admin = adminClient()
  const { data: files } = await admin.storage.from('toy-photos-library').list(toyId)
  if (files?.length)
    await admin.storage.from('toy-photos-library').remove(files.map((f) => `${toyId}/${f.name}`))
  await cleanupOrg(orgId)
  await deleteTestUser(leader.id)
  await deleteTestUser(outsider.id)
})

describe('org toy photos', () => {
  it('lets a leader upload a cover photo for their org’s stock', async () => {
    const res = await uploadCover(leader.token, toyId)
    expect(res.status).toBe(200)
    const { url } = (await res.json()) as { url: string }
    expect(url).toContain(toyId)
  })

  it('refuses someone who leads no organisation at all', async () => {
    const res = await uploadCover(outsider.token, toyId)
    expect(res.status).toBe(404)
  })
})
