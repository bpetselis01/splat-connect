import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createUserClient } from '../../../src/supabase/user-client.js'
import { createAnonClient } from '../../../src/supabase/client.js'

/**
 * 049 made tutorial-pdfs and stl-files private with a signed-in-only SELECT
 * policy. This is the only test that exercises the bucket flag and the policy
 * together — a unit test mocks the storage client and would pass against a
 * public bucket.
 */
let user: TestUser
const tutorialId = crypto.randomUUID()
const pdfPath = `${tutorialId}/tutorial.pdf`
const stlPath = `${tutorialId}/bracket.stl`
const photoPath = `${tutorialId}/photo.jpg`

beforeAll(async () => {
  user = await createTestUser('contributor')
  const admin = adminClient()
  await admin.storage.from('tutorial-pdfs').upload(pdfPath, new Blob(['%PDF-1.4 gate']), { upsert: true })
  await admin.storage.from('stl-files').upload(stlPath, new Blob(['solid gate']), { upsert: true })
  await admin.storage.from('toy-photos').upload(photoPath, new Blob(['photo gate']), { upsert: true })
})

afterAll(async () => {
  const admin = adminClient()
  await admin.storage.from('tutorial-pdfs').remove([pdfPath])
  await admin.storage.from('stl-files').remove([stlPath])
  await admin.storage.from('toy-photos').remove([photoPath])
  await deleteTestUser(user.id)
})

// 049 only flipped tutorial-pdfs and stl-files; toy-photos stayed public so
// browse cards can keep loading cover photos with no session.
it('toy-photos stays public', async () => {
  const { data } = createAnonClient().storage.from('toy-photos').getPublicUrl(photoPath)
  const res = await fetch(data.publicUrl)
  expect(res.status).toBe(200)
})

describe.each([
  ['tutorial-pdfs', pdfPath],
  ['stl-files', stlPath],
])('%s', (bucket, path) => {
  it('is not served at its old public URL', async () => {
    const { data } = createAnonClient().storage.from(bucket).getPublicUrl(path)
    const res = await fetch(data.publicUrl)
    expect(res.ok).toBe(false)
  })

  it('cannot be signed by an anonymous client', async () => {
    const { data, error } = await createAnonClient().storage.from(bucket).createSignedUrl(path, 60)
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })

  it('is signed and served for a signed-in user', async () => {
    const { data, error } = await createUserClient(user.token).storage.from(bucket).createSignedUrl(path, 60)
    expect(error).toBeNull()
    const res = await fetch(data!.signedUrl)
    expect(res.status).toBe(200)
  })
})
