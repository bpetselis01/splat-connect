/**
 * Live and Done: claimed and handed-over builds from the board, with the
 * maker named and the family no more identified than on the open row. A
 * build asked of a named maker never appears. A Done row says only what was
 * built, by whom and when (F19); so does a Live row to anyone but its two
 * parties (F19b).
 */
// journeys: K01 X01
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'

let family: TestUser
let maker: TestUser
let onlooker: TestUser
let tutorialId: string
const MAKER = `Tom ${Date.now()}`

const board = async (u: TestUser, q: string) =>
  app.request(`/api/toy-transactions/builds-board?${q}`, { headers: { Authorization: `Bearer ${u.token}` } })
type Row = {
  travel_km: number | null
  urgency: string | null
  family_has_toy: boolean
  id: string
  maker_name: string
  mine: boolean
  party: boolean
  km: number | null
  requester_id?: string
  requester_suburb: string | null
  build_brief: string | null
  updated_at: string
}

beforeAll(async () => {
  ;[family, maker, onlooker] = await Promise.all([
    createTestUser('contributor'),
    createTestUser('contributor'),
    createTestUser('contributor'),
  ])
  const db = adminClient()
  await db.from('profiles').update({ name: MAKER }).eq('id', maker.id)
  const t = await db
    .from('tutorials')
    .insert({ title: `Board ${Date.now()}`, description: 'G', difficulty: 'easy', status: 'approved' })
    .select('id')
    .single()
  if (t.error) throw t.error
  tutorialId = t.data.id
  const base = {
    type: 'build',
    tutorial_id: tutorialId,
    requester_id: family.id,
    owner_id: maker.id,
    owner_code: '111111',
    requester_code: '222222',
  }
  const rows = await db.from('toy_transactions').insert([
    { ...base, status: 'accepted', travel_km: 10, requester_suburb: 'Newtown', build_brief: 'Live note', urgency: 'No rush' },
    { ...base, status: 'completed', travel_km: 5, requester_suburb: 'Enmore', build_brief: 'Her chair' },
    // Asked of this maker by name: private to the two of them.
    { ...base, status: 'accepted', build_brief: 'Just for you' },
  ])
  if (rows.error) throw rows.error
})

afterAll(async () => {
  await adminClient().from('toy_transactions').delete().eq('tutorial_id', tutorialId)
  await adminClient().from('tutorials').delete().eq('id', tutorialId)
  await Promise.all([family, maker, onlooker].map((u) => deleteTestUser(u.id)))
})

describe('GET /api/toy-transactions/builds-board', () => {
  it('lists a claimed board build under Live with its maker, and never the family', async () => {
    const res = await board(onlooker, 'tab=live')
    expect(res.status).toBe(200)
    const text = await res.text()
    const rows = (JSON.parse(text) as Row[]).filter((r) => r.maker_name === MAKER)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      mine: false, party: false, km: null,
      requester_suburb: null, build_brief: null, travel_km: null, urgency: null, family_has_toy: false,
    })
    expect(rows[0].requester_id).toBeUndefined()
    expect(text).not.toContain(family.id)
    expect(text).not.toContain('Just for you')
    expect(text).not.toContain('child_label')
    expect(text).not.toContain('Newtown')
    expect(text).not.toContain('Live note')
  })

  it('marks the maker and the family as parties, who still see their own build', async () => {
    const forMaker = ((await (await board(maker, 'tab=live')).json()) as Row[]).find((r) => r.maker_name === MAKER)
    const forFamily = ((await (await board(family, 'tab=live')).json()) as Row[]).find((r) => r.maker_name === MAKER)
    const own = { requester_suburb: 'Newtown', build_brief: 'Live note' }
    expect(forMaker).toMatchObject({ party: true, mine: false, ...own })
    expect(forFamily).toMatchObject({ party: true, mine: true, ...own })
  })

  it('lists a handed-over board build under Done with the guide, maker and date only', async () => {
    const res = await board(onlooker, 'tab=done')
    const text = await res.text()
    const rows = (JSON.parse(text) as Row[]).filter((r) => r.maker_name === MAKER)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ requester_suburb: null, build_brief: null, km: null })
    expect(typeof rows[0].updated_at).toBe('string')
    expect(text).not.toContain('child_label')
    expect(text).not.toContain('Enmore')
    expect(text).not.toContain('Her chair')
  })

  it('answers a page past the end with nothing, and refuses an unknown tab', async () => {
    expect(await (await board(onlooker, 'tab=done&page=999')).json()).toEqual([])
    const bad = await board(onlooker, 'tab=open')
    expect(bad.status).toBe(400)
    expect(await bad.json()).toEqual({ error: 'tab must be live or done' })
  })

  it('is signed in only', async () => {
    expect((await app.request('/api/toy-transactions/builds-board?tab=live')).status).toBe(401)
  })
})
