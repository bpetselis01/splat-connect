// POST /api/tutorials/import-pdf: reads a PDF into a draft and writes nothing.
import { readFileSync } from 'node:fs'
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { acceptTerms } from '../../helpers/orgs.js'
import { createGuideFromPdfDraft, type PdfDraftApi, type PdfImportDraft } from '@splat-connect/types'

let user: TestUser
const created: string[] = []

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
  await acceptTerms(user.id, 'contributor_terms')
})

afterAll(async () => {
  const admin = adminClient()
  for (const id of created) {
    await admin.storage.from('tutorial-pdfs').remove([`${id}/tutorial.pdf`])
    await admin.from('tutorials').delete().eq('id', id)
  }
  await deleteTestUser(user.id)
})

/** The shared create sequence's client, pointed at the app in-process. */
const inProcess: PdfDraftApi = Object.fromEntries(
  (['get', 'post', 'patch', 'put'] as const).map((method) => [
    method,
    async (path: string, body?: unknown) => {
      const res = await app.request(path, {
        method: method.toUpperCase(),
        headers: { Authorization: `Bearer ${user.token}`, 'Content-Type': 'application/json' },
        ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
      })
      if (!res.ok) throw Object.assign(new Error(`${method} ${path} failed with status ${res.status}`), { status: res.status })
      const text = await res.text()
      return text ? JSON.parse(text) : null
    },
  ])
) as unknown as PdfDraftApi

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

  it('turns into a real draft through the ordinary routes: PDF stored once, parts, tools and steps saved', async () => {
    const read = await post(new File([fixture], 'guide.pdf', { type: 'application/pdf' }))
    const draft = (await read.json()) as PdfImportDraft
    const id = crypto.randomUUID()
    created.push(id)

    const result = await createGuideFromPdfDraft(inProcess, id, draft, async (tutorialId) => {
      const fd = new FormData()
      fd.append('file', new File([fixture], 'guide.pdf', { type: 'application/pdf' }))
      fd.append('tutorialId', tutorialId)
      const res = await app.request('/api/upload/pdf', {
        method: 'POST',
        headers: { Authorization: `Bearer ${user.token}` },
        body: fd,
      })
      return ((await res.json()) as { url: string }).url
    })
    expect(result).toEqual({ failed: [], stepsUnavailable: false })

    const admin = adminClient()
    const { data: row } = await admin.from('tutorials').select('title, kind, tutorial_pdf_url').eq('id', id).single()
    expect(row).toEqual({ title: 'Low Profile Switch', kind: 'assistive_tech', tutorial_pdf_url: `${id}/tutorial.pdf` })
    const { count: parts } = await admin.from('parts').select('id', { count: 'exact', head: true }).eq('tutorial_id', id)
    const { count: tools } = await admin.from('tools').select('id', { count: 'exact', head: true }).eq('tutorial_id', id)
    const { data: steps } = await admin.from('tutorial_steps').select('position, body').eq('tutorial_id', id).order('position')
    expect(parts).toBe(4)
    expect(tools).toBe(4)
    expect(steps).toHaveLength(16)
    expect(steps![0]).toEqual({ position: 1, body: 'Cut off the two leads on one side flush.' })
  })

  it('needs a signed-in caller', async () => {
    const res = await post(new File([fixture], 'guide.pdf', { type: 'application/pdf' }), null)
    expect(res.status).toBe(401)
  })
})
