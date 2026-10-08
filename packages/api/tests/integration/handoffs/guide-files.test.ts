// journeys: G16 G30 L03
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'
import { createUserClient } from '../../../src/supabase/client.js'

/**
 * The guide's files, the way the phone reads them: GET the guide (the 3D pill
 * and the Files tab read stl_files off it), then sign the object path with the
 * app's own session (preview PDF, review PDF, model viewer). The signing is a
 * storage call, not an API route, so it runs against local storage here; the
 * bucket flag and the anonymous refusal live in storage/storage-gate.test.ts.
 */
let reader: TestUser
let tutorialId: string
let pdfPath: string
let stlPath: string

beforeAll(async () => {
  reader = await createTestUser()
  tutorialId = await createProject({ authorId: reader.id, status: 'approved', title: 'Files fixture' })
  pdfPath = `${tutorialId}/guide.pdf`
  stlPath = `${tutorialId}/bracket.stl`
  const admin = adminClient()
  await admin.storage.from('tutorial-pdfs').upload(pdfPath, new Blob(['%PDF-1.4 files']), { upsert: true })
  await admin.storage.from('stl-files').upload(stlPath, new Blob(['solid files']), { upsert: true })
  await admin.from('tutorials').update({ tutorial_pdf_url: pdfPath }).eq('id', tutorialId)
  await admin.from('stl_files').insert({ tutorial_id: tutorialId, filename: 'bracket.stl', file_url: stlPath })
})

afterAll(async () => {
  const admin = adminClient()
  await admin.storage.from('tutorial-pdfs').remove([pdfPath])
  await admin.storage.from('stl-files').remove([stlPath])
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await deleteTestUser(reader.id)
})

describe('guide files', () => {
  it('G30: the guide carries its model files as storage paths', async () => {
    const res = await app.request(`/api/public/tutorials/${tutorialId}`)
    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      tutorial_pdf_url: string
      stl_files: { filename: string; file_url: string }[]
    }
    expect(body.tutorial_pdf_url).toBe(pdfPath)
    expect(body.stl_files.map((f) => f.file_url)).toEqual([stlPath])
  })

  it('G16/L03: the PDF path signs for 60 seconds and the link serves the file', async () => {
    const { data, error } = await createUserClient(reader.token).storage.from('tutorial-pdfs').createSignedUrl(pdfPath, 60)
    expect(error).toBeNull()
    expect(new URL(data!.signedUrl).searchParams.get('token')).toBeTruthy()
    const res = await fetch(data!.signedUrl)
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('%PDF')
  })

  it('G30: the model path signs and serves too', async () => {
    const { data, error } = await createUserClient(reader.token).storage.from('stl-files').createSignedUrl(stlPath, 60)
    expect(error).toBeNull()
    expect((await fetch(data!.signedUrl)).status).toBe(200)
  })

  it('G16: a path that is not there gives no link, so the preview opens empty rather than broken', async () => {
    const { data, error } = await createUserClient(reader.token).storage.from('tutorial-pdfs').createSignedUrl(`${tutorialId}/nope.pdf`, 60)
    expect(data).toBeNull()
    expect(error).not.toBeNull()
  })
})
