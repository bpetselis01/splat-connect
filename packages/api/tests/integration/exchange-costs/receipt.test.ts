// journeys: (none — route coverage; no journey row names this route yet)
/**
 * POST /api/exchange-costs/:transactionId/receipt stores a receipt in the
 * private exchange-receipts bucket at <transaction_id>/<file> and returns the
 * path. Only the two parties may upload; the bucket, not the handler, refuses
 * a file type that is not an image or a PDF.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let payer: TestUser
let payee: TestUser
let outsider: TestUser
let toyId: string
let transactionId: string

const upload = (id: string, token: string, file?: File) => {
  const form = new FormData()
  if (file) form.append('file', file)
  return app.request(`/api/exchange-costs/${id}/receipt`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form })
}
const png = (name: string) => new File([new Uint8Array([137, 80, 78, 71])], name, { type: 'image/png' })
const stored = async (path: string) => (await adminClient().storage.from('exchange-receipts').list(transactionId)).data!.some((f) => `${transactionId}/${f.name}` === path)

beforeAll(async () => {
  ;[payer, payee, outsider] = await Promise.all([createTestUser('contributor'), createTestUser('contributor'), createTestUser('contributor')])
  const admin = adminClient()
  const { data: toy } = await admin
    .from('toys')
    .insert({ owner_id: payee.id, name: 'Receipt spinner', condition: 7, photo_urls: ['https://example.invalid/a.jpg'], offer_type: 'donation', status: 'published' })
    .select('id')
    .single()
  toyId = toy!.id
  const { data: tx } = await admin
    .from('toy_transactions')
    .insert({ toy_id: toyId, type: 'donation', status: 'accepted', requester_id: payer.id, owner_id: payee.id })
    .select('id')
    .single()
  transactionId = tx!.id
})
afterAll(async () => {
  const admin = adminClient()
  const { data } = await admin.storage.from('exchange-receipts').list(transactionId)
  if (data?.length) await admin.storage.from('exchange-receipts').remove(data.map((f) => `${transactionId}/${f.name}`))
  await admin.from('toy_transactions').delete().eq('id', transactionId)
  await admin.from('toys').delete().eq('id', toyId)
  for (const u of [payer, payee, outsider]) await deleteTestUser(u.id)
})

describe('uploading an exchange receipt', () => {
  it('stores the file under the exchange id for either party and returns its path', async () => {
    const byPayee = await upload(transactionId, payee.token, png('lunch.png'))
    expect(byPayee.status).toBe(200)
    expect(await byPayee.json()).toEqual({ receipt_path: `${transactionId}/lunch.png` })
    expect(await stored(`${transactionId}/lunch.png`)).toBe(true)

    const byPayer = await upload(transactionId, payer.token, png('bank.png'))
    expect(await byPayer.json()).toEqual({ receipt_path: `${transactionId}/bank.png` })
    expect(await stored(`${transactionId}/bank.png`)).toBe(true)
  })

  it('refuses someone who is not on the exchange and stores nothing', async () => {
    const res = await upload(transactionId, outsider.token, png('sneaky.png'))
    // RLS hides the exchange from them, so the refusal reads as an unknown one.
    expect(res.status).toBe(404)
    expect(await res.json()).toEqual({ error: 'No such exchange.' })
    expect(await stored(`${transactionId}/sneaky.png`)).toBe(false)
  })

  it('needs a file, and a known exchange', async () => {
    const none = await upload(transactionId, payee.token)
    expect(none.status).toBe(400)
    expect(await none.json()).toEqual({ error: 'A file is required.' })
    const unknown = await upload(crypto.randomUUID(), payee.token, png('x.png'))
    expect(unknown.status).toBe(404)
    expect(await unknown.json()).toEqual({ error: 'No such exchange.' })
  })

  // Pinned as it behaves: the handler has no MIME check, so the bucket's
  // allowed_mime_types answers with a 500 rather than a 400.
  it('has the bucket reject a file type that is not an image or a PDF, as a 500', async () => {
    const res = await upload(transactionId, payee.token, new File(['hello'], 'notes.txt', { type: 'text/plain' }))
    expect(res.status).toBe(500)
    expect(await stored(`${transactionId}/notes.txt`)).toBe(false)
  })
})
