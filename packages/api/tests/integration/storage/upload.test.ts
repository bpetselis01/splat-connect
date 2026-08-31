import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { acceptTerms } from '../../helpers/orgs.js'
import { createUserClient } from '../../../src/supabase/client.js'

let user: TestUser
let stranger: TestUser
const tutorialId = crypto.randomUUID()

function uploadRequest(path: string, token: string, file: File) {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('tutorialId', tutorialId)
  return app.request(path, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  })
}

beforeAll(async () => {
  user = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
  // The upload handlers only write into a tutorial the caller contributes to,
  // so the folder needs a real tutorial behind it — a bare UUID 404s.
  await acceptTerms(user.id, 'contributor_terms')

  const authed = { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' }
  const create = await app.request('/api/tutorials', {
    method: 'POST',
    headers: authed,
    body: JSON.stringify({ id: tutorialId, title: 'Upload Fixture', difficulty: 'easy' }),
  })
  expect(create.status).toBe(201)

  const link = await app.request(`/api/contributors/me/tutorials/${tutorialId}`, {
    method: 'POST',
    headers: authed,
  })
  expect(link.status).toBe(201)
})

afterAll(async () => {
  const admin = adminClient()
  await admin.storage.from('tutorial-pdfs').remove([`${tutorialId}/tutorial.pdf`])
  const { data: photos } = await admin.storage.from('toy-photos').list(tutorialId)
  if (photos?.length)
    await admin.storage.from('toy-photos').remove(photos.map((f) => `${tutorialId}/${f.name}`))
  await admin.storage.from('stl-files').remove([`${tutorialId}/bracket.stl`])
  // tutorials have no FK to profiles — delete explicitly before the user
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(user.id)
  await deleteTestUser(stranger.id)
})

describe('storage uploads', () => {
  it('uploads a PDF to the tutorial-pdfs bucket and returns its path', async () => {
    const res = await uploadRequest(
      '/api/upload/pdf',
      user.token,
      new File(['%PDF-1.4 test'], 'tutorial.pdf', { type: 'application/pdf' })
    )
    expect(res.status).toBe(200)
    const { url } = (await res.json()) as { url: string }
    expect(url).toBe(`${tutorialId}/tutorial.pdf`)
  })

  it('replacing a photo deletes the old file (jpg -> png leaves exactly one)', async () => {
    const first = await uploadRequest(
      '/api/upload/photo',
      user.token,
      new File(['jpg-bytes'], 'photo.jpg', { type: 'image/jpeg' })
    )
    expect(first.status).toBe(200)

    const second = await uploadRequest(
      '/api/upload/photo',
      user.token,
      new File(['png-bytes'], 'photo.png', { type: 'image/png' })
    )
    expect(second.status).toBe(200)

    const { data: files } = await adminClient().storage.from('toy-photos').list(tutorialId)
    expect(files?.length).toBe(1)
    expect(files?.[0].name).toBe('photo.png')
  })

  it('uploads an STL to the stl-files bucket and returns path + filename', async () => {
    const res = await uploadRequest(
      '/api/upload/stl',
      user.token,
      new File(['solid bracket'], 'bracket.stl', { type: 'application/octet-stream' })
    )
    expect(res.status).toBe(200)
    const body = (await res.json()) as { url: string; filename: string }
    expect(body.url).toBe(`${tutorialId}/bracket.stl`)
    expect(body.filename).toBe('bracket.stl')
  })
})

// Runs after the uploads above, so the victim's files are really there to steal.
describe("writing into another tutorial's folder", () => {
  it('404s an upload aimed at a tutorial the caller does not contribute to', async () => {
    const res = await uploadRequest(
      '/api/upload/stl',
      stranger.token,
      new File(['malicious'], 'bracket.stl', { type: 'application/octet-stream' })
    )
    expect(res.status).toBe(404)
  })

  it('storage RLS blocks a direct overwrite that skips the API', async () => {
    const { error } = await createUserClient(stranger.token)
      .storage.from('stl-files')
      .upload(`${tutorialId}/bracket.stl`, new File(['malicious'], 'bracket.stl'), { upsert: true })
    expect(error?.message).toContain('row-level security')

    const { data } = await adminClient().storage.from('stl-files').download(`${tutorialId}/bracket.stl`)
    expect(await data?.text()).toBe('solid bracket')
  })
})
