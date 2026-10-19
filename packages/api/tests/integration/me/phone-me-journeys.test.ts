/** What the phone's Me tab and Explore search read from the server. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { addLeader, createOrg } from '../../helpers/orgs.js'

let leader: TestUser
let member: TestUser
const orgIds: string[] = []
const toyIds: string[] = []
const tutorialIds: string[] = []

const get = (token: string, path: string) => app.request(`/api${path}`, { headers: { Authorization: `Bearer ${token}` } })

beforeAll(async () => {
  ;[leader, member] = await Promise.all([createTestUser(), createTestUser()])
})

afterAll(async () => {
  const sb = adminClient()
  await sb.from('toys').delete().in('id', toyIds)
  await sb.from('tutorials').delete().in('id', tutorialIds)
  await sb.from('organizations').delete().in('id', orgIds)
  await Promise.all([leader, member].map((u) => deleteTestUser(u.id)))
})

describe('GET /api/organizations/mine', () => {
  it('Q20 gives a leader of two organisations both, for the Acting-for switcher, and a member none', async () => {
    const first = await createOrg({ createdBy: leader.id, name: 'Northside Makers' })
    const second = await createOrg({ createdBy: leader.id, name: 'Westside Printers' })
    orgIds.push(first, second)
    await addLeader(first, leader.id)
    await addLeader(second, leader.id)

    const led = (await (await get(leader.token, '/organizations/mine')).json()) as { id: string; name: string }[]
    expect(led.map((o) => [o.id, o.name]).sort()).toEqual([[first, 'Northside Makers'], [second, 'Westside Printers']].sort())
    expect(await (await get(member.token, '/organizations/mine')).json()).toEqual([])
  })
})

describe('the three lists Explore search filters', () => {
  it('Q13 serves a published guide, a published toy and an organisation by the name a search types', async () => {
    const tag = crypto.randomUUID().slice(0, 8)
    const tutorialId = crypto.randomUUID()
    tutorialIds.push(tutorialId)
    await adminClient().from('tutorials').insert({
      id: tutorialId, title: `Searchable guide ${tag}`, difficulty: 'easy', status: 'approved', tutorial_pdf_url: `${tutorialId}/g.pdf`,
    })
    await adminClient().from('tutorial_contributors').insert({ tutorial_id: tutorialId, profile_id: leader.id, role: 'primary' })
    const { data: toy } = await adminClient()
      .from('toys')
      .insert({ owner_id: leader.id, name: `Searchable toy ${tag}`, condition: 7, offer_type: 'donation', status: 'published', photo_urls: [null] })
      .select('id')
      .single()
    toyIds.push(toy!.id)
    const orgId = await createOrg({ createdBy: leader.id, name: `Searchable org ${tag}` })
    orgIds.push(orgId)

    const guides = (await (await app.request('/api/public/tutorials')).json()) as { title: string }[]
    const toys = (await (await app.request('/api/public/toys')).json()) as { name: string }[]
    const orgs = (await (await app.request('/api/public/organizations')).json()) as { name: string }[]
    expect(guides.map((g) => g.title)).toContain(`Searchable guide ${tag}`)
    expect(toys.map((t) => t.name)).toContain(`Searchable toy ${tag}`)
    expect(orgs.map((o) => o.name)).toContain(`Searchable org ${tag}`)
  })
})
