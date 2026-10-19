/**
 * The build chain, one notification row per action: who is told, what type, and
 * which transaction it opens (toy_transaction_id is the link target; mobile
 * opens build_shot_posted / build_approved in the build thread).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { nameUser, notesAbout } from '../../helpers/notifications.js'

const TITLE = 'Bubble machine, notified'
let family: TestUser
let maker: TestUser
let tutorialId: string

const json = (token: string, body: unknown = {}) => ({
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
})
const post = (path: string, token: string, body?: unknown) => app.request(`/api/toy-transactions${path}`, json(token, body))
const shot = (token: string) => {
  const form = new FormData()
  form.append('file', new File([new Uint8Array([1, 2, 3])], 'shot.png', { type: 'image/png' }))
  return { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form }
}

/** A directed ask to the maker (a row the maker can accept or decline). */
async function askMaker() {
  const res = await post('/build', family.token, { tutorial_id: tutorialId, maker_id: maker.id, build_brief: 'For Leo' })
  expect(res.status).toBe(201)
  return ((await res.json()) as { id: string }).id
}
/** An open post on Makers wanted. */
async function postOpen() {
  const res = await post('/build', family.token, {
    tutorial_id: tutorialId, build_brief: 'For Leo', requester_suburb: 'Newtown', travel_km: 20,
  })
  expect(res.status).toBe(201)
  return ((await res.json()) as { id: string }).id
}
const only = async (who: TestUser, id: string, type: string) => (await notesAbout(who.id, id)).filter((n) => n.type === type)

beforeAll(async () => {
  family = await createTestUser('contributor')
  maker = await createTestUser('contributor')
  await nameUser(family.id, 'Fern Family')
  await nameUser(maker.id, 'Max Maker')
  const { data } = await adminClient()
    .from('tutorials')
    .insert({ title: TITLE, description: 'A guide', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  tutorialId = data!.id
  await adminClient().from('tutorial_contributors').insert({ tutorial_id: tutorialId, profile_id: maker.id, role: 'author' })
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await admin.from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([deleteTestUser(family.id), deleteTestUser(maker.id)])
})

describe('asking for a build (K05)', () => {
  it('WI28 a directed ask tells the maker, naming the guide', async () => {
    const id = await askMaker()
    expect(await notesAbout(maker.id, id)).toEqual([
      { recipient_id: maker.id, type: 'toy_request', toy_transaction_id: id, toy_name: TITLE, actor_name: 'Fern Family', body: null },
    ])
    await post(`/${id}/withdraw`, family.token)
  })

  it('K05 WI26 an open post on Makers wanted tells nobody: the board is the notice', async () => {
    const id = await postOpen()
    const { data } = await adminClient().from('notifications').select('id').eq('toy_transaction_id', id)
    expect(data).toEqual([])
    // Removed directly: POST /:id/withdraw on an unclaimed post 500s today, because
    // toy_transactions_one_owner (064) wants an owner on every status but 'requested'.
    await adminClient().from('toy_transactions').delete().eq('id', id)
  })
})

describe('taking a build on (K02, K04, K06)', () => {
  it('K02 WI25 claiming an open post tells the family, in the maker’s name', async () => {
    const id = await postOpen()
    expect((await post(`/${id}/claim`, maker.token)).status).toBe(200)
    expect(await notesAbout(family.id, id)).toEqual([
      { recipient_id: family.id, type: 'toy_accepted', toy_transaction_id: id, toy_name: TITLE, actor_name: 'Max Maker', body: null },
    ])
    await post(`/${id}/withdraw`, family.token)
  })

  it('K04 WX25 claiming after asking first notifies the same way (the question is copied into the thread)', async () => {
    const id = await postOpen()
    expect((await post(`/${id}/questions`, maker.token, { body: 'Is the switch 100 mm?' })).status).toBeLessThan(300)
    expect((await post(`/${id}/claim`, maker.token)).status).toBe(200)
    const accepted = await only(family, id, 'toy_accepted')
    expect(accepted).toHaveLength(1)
    expect(accepted[0]).toMatchObject({ recipient_id: family.id, toy_transaction_id: id, actor_name: 'Max Maker' })
    await post(`/${id}/withdraw`, family.token)
  })

  it('K06 WX16 accepting a directed ask tells the family', async () => {
    const id = await askMaker()
    const res = await post(`/${id}/accept`, maker.token, {
      pickup_line1: '1 Test St', pickup_suburb: 'Testville', pickup_state: 'VIC', pickup_postcode: '3000',
    })
    expect(res.status).toBe(200)
    expect(await notesAbout(family.id, id)).toEqual([
      { recipient_id: family.id, type: 'toy_accepted', toy_transaction_id: id, toy_name: TITLE, actor_name: 'Max Maker', body: null },
    ])
    await post(`/${id}/withdraw`, family.token)
  })
})

describe('declining (K07)', () => {
  it('K07 WX17 tells the family, with the maker’s reason as the body', async () => {
    const id = await askMaker()
    expect((await post(`/${id}/reject`, maker.token, { reason: 'No time this month' })).status).toBe(200)
    expect(await notesAbout(family.id, id)).toEqual([
      { recipient_id: family.id, type: 'toy_rejected', toy_transaction_id: id, toy_name: TITLE, actor_name: 'Max Maker', body: 'No time this month' },
    ])
  })
})

describe('the working shot and the handover (K08, K09, K13)', () => {
  it('K08 K09 K13 WX20 WX21 WX15 the maker’s shot tells the family; the family’s approval tells the maker; messages go both ways', async () => {
    const id = await postOpen()
    await post(`/${id}/claim`, maker.token)

    expect((await app.request(`/api/toy-transactions/${id}/working-shot`, shot(maker.token))).status).toBe(200)
    expect(await only(family, id, 'build_shot_posted')).toEqual([
      { recipient_id: family.id, type: 'build_shot_posted', toy_transaction_id: id, toy_name: TITLE, actor_name: 'Max Maker', body: null },
    ])

    expect((await post(`/${id}/approve-work`, family.token)).status).toBe(200)
    expect(await only(maker, id, 'build_approved')).toEqual([
      { recipient_id: maker.id, type: 'build_approved', toy_transaction_id: id, toy_name: TITLE, actor_name: 'Fern Family', body: null },
    ])

    await post(`/${id}/messages`, maker.token, { body: 'Pickup Friday?' })
    await post(`/${id}/messages`, family.token, { body: 'Friday is perfect' })
    expect(await only(family, id, 'toy_message')).toMatchObject([{ actor_name: 'Max Maker', body: 'Pickup Friday?' }])
    expect(await only(maker, id, 'toy_message')).toMatchObject([{ actor_name: 'Fern Family', body: 'Friday is perfect' }])
    await post(`/${id}/withdraw`, family.token)
  })
})

describe('withdrawing (K12)', () => {
  it('K12 WX18 the family withdrawing tells the maker', async () => {
    const id = await askMaker()
    expect((await post(`/${id}/withdraw`, family.token)).status).toBe(200)
    expect(await only(maker, id, 'toy_withdrawn')).toEqual([
      { recipient_id: maker.id, type: 'toy_withdrawn', toy_transaction_id: id, toy_name: TITLE, actor_name: 'Fern Family', body: null },
    ])
  })

  it('K12 WX18 the maker withdrawing tells the family', async () => {
    const id = await postOpen()
    await post(`/${id}/claim`, maker.token)
    expect((await post(`/${id}/withdraw`, maker.token)).status).toBe(200)
    expect(await only(family, id, 'toy_withdrawn')).toEqual([
      { recipient_id: family.id, type: 'toy_withdrawn', toy_transaction_id: id, toy_name: TITLE, actor_name: 'Max Maker', body: null },
    ])
  })
})
