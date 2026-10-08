// journeys: R03 R05 R06 R07 R08 R13 R14
/**
 * The print job chain, one notification row per action: who is told, what type,
 * and which transaction it opens (toy_transaction_id is the link target; mobile
 * opens print_started / print_ready on the print job screen).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { nameUser, notesAbout } from '../../helpers/notifications.js'

const TITLE = 'Print chain guide'
const PICKUP = { pickup_line1: '1 Test St', pickup_suburb: 'Newtown', pickup_state: 'NSW', pickup_postcode: '2042' }
let family: TestUser
let printer: TestUser
let tutorialId: string
let printerId: string
let stlIds: string[]

const json = (token: string, body: unknown = {}) => ({
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
const post = (path: string, token: string, body?: unknown) => app.request(`/api/toy-transactions${path}`, json(token, body))
const photo = (token: string) => {
  const form = new FormData()
  form.append('file', new File([new Uint8Array([1, 2, 3])], 'ready.png', { type: 'image/png' }))
  return { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
}
const only = async (who: TestUser, id: string, type: string) => (await notesAbout(who.id, id)).filter((n) => n.type === type)

async function ask() {
  const res = await post('/print', family.token, { printer_ids: [printerId], tutorial_id: tutorialId, stl_file_ids: stlIds })
  expect(res.status).toBe(201)
  return ((await res.json()) as { id: string }).id
}

beforeAll(async () => {
  family = await createTestUser('contributor')
  printer = await createTestUser('contributor')
  await nameUser(family.id, 'Fern Family')
  await nameUser(printer.id, 'Pat Printer')
  const admin = adminClient()
  const { data: t } = await admin
    .from('tutorials')
    .insert({ title: TITLE, description: 'x', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = t!.id
  const { data: files } = await admin
    .from('stl_files')
    .insert([{ tutorial_id: tutorialId, filename: 'part.stl', file_url: `${tutorialId}/part.stl` }])
    .select('id')
  stlIds = files!.map((f: { id: string }) => f.id)
  const { data: p } = await admin
    .from('printers')
    .insert({ owner_id: printer.id, name: 'Chain printer', materials: ['PLA'], bed_x: 200, bed_y: 200, bed_z: 200, capacity: 3 })
    .select('id')
    .single()
  printerId = p!.id
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await admin.from('printers').delete().eq('id', printerId)
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([deleteTestUser(family.id), deleteTestUser(printer.id)])
})

describe('asking a printer (R03)', () => {
  it('tells the printer, naming the guide and the family', async () => {
    const id = await ask()
    expect(await notesAbout(printer.id, id)).toEqual([
      { recipient_id: printer.id, type: 'toy_request', toy_transaction_id: id, toy_name: TITLE, actor_name: 'Fern Family', body: null },
    ])
    expect(await notesAbout(family.id, id)).toEqual([])
    await post(`/${id}/withdraw`, family.token)
  })
})

describe('the printer answering (R13, R14)', () => {
  it('declining tells the family, with the reason as the body', async () => {
    const id = await ask()
    expect((await post(`/${id}/reject`, printer.token, { reason: 'Machine is down this week' })).status).toBe(200)
    expect(await notesAbout(family.id, id)).toEqual([
      { recipient_id: family.id, type: 'toy_rejected', toy_transaction_id: id, toy_name: TITLE, actor_name: 'Pat Printer', body: 'Machine is down this week' },
    ])
  })

  it('accepting tells the family, in the printer’s name', async () => {
    const id = await ask()
    expect((await post(`/${id}/accept`, printer.token, PICKUP)).status).toBe(200)
    expect(await notesAbout(family.id, id)).toEqual([
      { recipient_id: family.id, type: 'toy_accepted', toy_transaction_id: id, toy_name: TITLE, actor_name: 'Pat Printer', body: null },
    ])
    await post(`/${id}/withdraw`, family.token)
  })
})

describe('the job under way (R05, R06, R07, R08)', () => {
  it('started and ready tell the family; messages go both ways; the family withdrawing tells the printer', async () => {
    const id = await ask()
    await post(`/${id}/accept`, printer.token, PICKUP)

    expect((await post(`/${id}/print-started`, printer.token)).status).toBe(200)
    expect(await only(family, id, 'print_started')).toEqual([
      { recipient_id: family.id, type: 'print_started', toy_transaction_id: id, toy_name: TITLE, actor_name: 'Pat Printer', body: null },
    ])

    expect((await app.request(`/api/toy-transactions/${id}/print-ready`, photo(printer.token))).status).toBe(200)
    expect(await only(family, id, 'print_ready')).toEqual([
      { recipient_id: family.id, type: 'print_ready', toy_transaction_id: id, toy_name: TITLE, actor_name: 'Pat Printer', body: null },
    ])

    await post(`/${id}/messages`, printer.token, { body: 'Parts are on the porch' })
    await post(`/${id}/messages`, family.token, { body: 'Thank you' })
    expect(await only(family, id, 'toy_message')).toMatchObject([{ actor_name: 'Pat Printer', body: 'Parts are on the porch' }])
    expect(await only(printer, id, 'toy_message')).toMatchObject([{ actor_name: 'Fern Family', body: 'Thank you' }])

    expect((await post(`/${id}/withdraw`, family.token)).status).toBe(200)
    expect(await only(printer, id, 'toy_withdrawn')).toEqual([
      { recipient_id: printer.id, type: 'toy_withdrawn', toy_transaction_id: id, toy_name: TITLE, actor_name: 'Fern Family', body: null },
    ])
  })
})
