import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let member: TestUser
let stranger: TestUser
let approvedId: string
let draftId: string

const authed = (u: TestUser) => ({ headers: { Authorization: `Bearer ${u.token}` } })

beforeAll(async () => {
  member = await createTestUser('contributor')
  stranger = await createTestUser('contributor')
  approvedId = await createProject({ authorId: stranger.id, status: 'approved', title: 'G01 library approved' })
  draftId = await createProject({ authorId: stranger.id, status: 'draft', title: 'G01 library draft' })
  const admin = adminClient()
  await admin.from('saves').insert({ profile_id: member.id, entity_type: 'tutorial', entity_id: approvedId })
  await admin.from('child_profiles').insert([
    { parent_id: member.id, age: 6 },
    { parent_id: stranger.id, age: 9 },
  ])
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('tutorials').delete().in('id', [approvedId, draftId])
  await deleteTestUser(member.id)
  await deleteTestUser(stranger.id)
})

describe('the Guides library load', () => {
  it('G01 WG01 serves the approved guide and not the draft, without a sign-in', async () => {
    const res = await app.request('/api/public/tutorials')
    expect(res.status).toBe(200)
    const ids = ((await res.json()) as Array<{ id: string }>).map((t) => t.id)
    expect(ids).toContain(approvedId)
    expect(ids).not.toContain(draftId)
  })

  it('G01 WG01 gives the Member their own saved guide ids and only their own children', async () => {
    const saved = await app.request('/api/saves/ids', authed(member))
    expect(saved.status).toBe(200)
    expect(((await saved.json()) as { tutorials: string[] }).tutorials).toEqual([approvedId])

    const kids = await app.request('/api/child-profiles', authed(member))
    expect(kids.status).toBe(200)
    expect(((await kids.json()) as Array<{ parent_id: string; age: number }>).map((k) => [k.parent_id, k.age])).toEqual([[member.id, 6]])
  })

  it('G01 WG01 gives a Member with nothing saved and no children empty lists', async () => {
    const other = await createTestUser('contributor')
    expect(await (await app.request('/api/saves/ids', authed(other))).json()).toMatchObject({ tutorials: [] })
    expect(await (await app.request('/api/child-profiles', authed(other))).json()).toEqual([])
    await deleteTestUser(other.id)
  })
})
