// POST /api/tutorials/import-pdf: reads a PDF into a draft and writes nothing.
import { readFileSync } from 'node:fs'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import type { PdfImportDraft } from '@splat-connect/types'

let user: TestUser

const fixture = readFileSync(
  new URL('../../fixtures/pdf-import/Low_Profile_Switch_Assembly_Guide_v1.0.pdf', import.meta.url)
)

function post(file: File | null, token: string | null = user.token) {
  const fd = new FormData()
  if (file) fd.append('file', file)
  return app.request('/api/tutorials/import-pdf', {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: fd,
  })
}

beforeAll(async () => {
  user = await createTestUser('contributor')
})

afterAll(async () => {
  await deleteTestUser(user.id)
})

describe('POST /api/tutorials/import-pdf', () => {
  it('answers with the draft read from the PDF, and creates no tutorial', async () => {
    const admin = adminClient()
    const { count: before } = await admin.from('tutorials').select('id', { count: 'exact', head: true })

    const res = await post(new File([fixture], 'guide.pdf', { type: 'application/pdf' }))
    expect(res.status).toBe(200)
    const draft = (await res.json()) as PdfImportDraft
    expect(draft.title).toBe('Low Profile Switch')
    expect(draft.parts).toHaveLength(4)
    expect(draft.steps).toHaveLength(16)
    expect(draft.warnings.length).toBeGreaterThan(0)

    const { count: after } = await admin.from('tutorials').select('id', { count: 'exact', head: true })
    expect(after).toBe(before)
  })

  it('reads the bytes, not the declared type — phones send octet-stream', async () => {
    const res = await post(new File([fixture], 'guide.pdf', { type: 'application/octet-stream' }))
    expect(res.status).toBe(200)
  })

  it('refuses a file that is not a PDF', async () => {
    const res = await post(new File(['hello'], 'notes.pdf', { type: 'application/pdf' }))
    expect(res.status).toBe(415)
  })

  it('refuses a damaged PDF with a sentence, not a crash', async () => {
    const res = await post(new File(['%PDF-1.4 not really'], 'broken.pdf', { type: 'application/pdf' }))
    expect(res.status).toBe(422)
    expect(((await res.json()) as { error: string }).error).toMatch(/Could not read this PDF/)
  })

  it('needs a file', async () => {
    expect((await post(null)).status).toBe(400)
  })

  it('refuses anything over 20 MB', async () => {
    const big = new Uint8Array(20 * 1024 * 1024 + 200 * 1024)
    big.set(new TextEncoder().encode('%PDF-'))
    expect((await post(new File([big], 'big.pdf', { type: 'application/pdf' }))).status).toBe(413)
  })

  it('needs a signed-in caller', async () => {
    const res = await post(new File([fixture], 'guide.pdf', { type: 'application/pdf' }), null)
    expect(res.status).toBe(401)
  })
})
