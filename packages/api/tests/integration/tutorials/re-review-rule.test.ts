// The re-review rule (decided 2026-10-20): content changes (steps, safety notes, parts, tools,
// STL files, and the details, photos and PDF the web editor sends with status: 'pending')
// send an approved guide back to pending; prices and recommendations leave it approved.
// This file pins the API half: the sub-resource writes move the guide themselves, and a
// PATCH carrying no status saves the fields and leaves the status alone.
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { acceptTerms, createProject } from '../../helpers/orgs.js'

let author: TestUser
let other: string
const guides: string[] = []

const call = (method: string, path: string, body: unknown) =>
  app.request(path, {
    method,
    headers: { Authorization: `Bearer ${author.token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
const statusOf = async (id: string) => (await adminClient().from('tutorials').select('status').eq('id', id).single()).data!.status
const updatedAt = async (id: string) => (await adminClient().from('tutorials').select('updated_at').eq('id', id).single()).data!.updated_at
const published = async (status: 'approved' | 'rejected' = 'approved') => {
  const id = await createProject({ authorId: author.id, status })
  await adminClient().from('tutorials').update({ safety_declared_at: new Date().toISOString(), build_minutes: 30 }).eq('id', id)
  guides.push(id)
  return id
}

beforeAll(async () => {
  author = await createTestUser('contributor')
  await acceptTerms(author.id, 'contributor_terms')
  other = await createProject({ authorId: author.id, status: 'approved' })
  guides.push(other)
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().in('id', guides)
  await deleteTestUser(author.id)
})

describe('content writes send an approved guide back to review', () => {
  it.each([
    ['parts', 'POST', (id: string) => [`/api/tutorials/${id}/parts`, { parts: [{ name: 'Jack', quantity: 1, is_optional: false, buy_links: [] }] }]],
    ['tools', 'POST', (id: string) => [`/api/tutorials/${id}/tools`, { tools: [{ name: 'Pliers', is_optional: false, buy_links: [] }] }]],
    ['steps', 'PUT', (id: string) => [`/api/tutorials/${id}/steps`, { steps: [{ body: 'Open it' }] }]],
    ['safety notes', 'POST', (id: string) => [`/api/tutorials/${id}/safety-notes`, { safety_notes: [{ title: 'Batteries', detail: null }] }]],
    ['STL files', 'POST', (id: string) => [`/api/tutorials/${id}/stl-files`, { stl_files: [{ filename: 'a.stl', file_url: `${id}/a.stl` }] }]],
    ['cleared parts', 'DELETE', (id: string) => [`/api/tutorials/${id}/parts`, undefined]],
  ] as const)('WT19 WT21 WT25 WT26 WT27 %s take an approved guide to pending', async (_name, method, build) => {
    const id = await published()
    const [path, body] = build(id)
    const res = await call(method, path as string, body)
    expect(res.status, await res.clone().text()).toBeLessThan(300)
    expect(await statusOf(id)).toBe('pending')
  })

  it('WT21 a steps write leaves a pending guide and a rejected guide as they were', async () => {
    const pending = await published('approved')
    await adminClient().from('tutorials').update({ status: 'pending' }).eq('id', pending)
    const rejected = await published('rejected')
    for (const id of [pending, rejected]) {
      expect((await call('PUT', `/api/tutorials/${id}/steps`, { steps: [{ body: 'Open it' }] })).status).toBe(200)
    }
    expect(await statusOf(pending)).toBe('pending')
    expect(await statusOf(rejected)).toBe('rejected')
  })

  it('WT21 an admin is told once that an unbacked guide is back in review', async () => {
    const reviewer = await createTestUser('admin')
    try {
      const id = await published()
      await call('PUT', `/api/tutorials/${id}/steps`, { steps: [{ body: 'Open it' }] })
      await call('PUT', `/api/tutorials/${id}/steps`, { steps: [{ body: 'Open it again' }] })
      const { count } = await adminClient().from('notifications').select('id', { count: 'exact', head: true })
        .eq('tutorial_id', id).eq('type', 'tutorial_submitted').eq('recipient_id', reviewer.id)
      expect(count).toBe(1)
    } finally {
      await deleteTestUser(reviewer.id)
    }
  })
})

describe('writes that leave an approved guide approved', () => {
  it('WT29 recommendations keep an approved guide approved', async () => {
    const id = await published()
    const res = await call('POST', `/api/tutorials/${id}/recommendations`, { recommendations: [{ recommended_id: other, required: false }] })
    expect(res.status, await res.clone().text()).toBeLessThan(300)
    expect(await statusOf(id)).toBe('approved')
  })

  it('WT25 a prices-checked date saved without a status keeps the guide approved', async () => {
    const id = await published()
    const res = await call('PATCH', `/api/tutorials/${id}`, { prices_checked_on: '2026-10-01', updated_at: await updatedAt(id) })
    expect(res.status, await res.clone().text()).toBe(200)
    const { data } = await adminClient().from('tutorials').select('status, prices_checked_on').eq('id', id).single()
    expect(data).toEqual({ status: 'approved', prices_checked_on: '2026-10-01' })
  })

  it('WT18 a details write without a status sends an approved guide back to review and tells the reviewers', async () => {
    const reviewer = await createTestUser('admin')
    try {
      const id = await published()
      const res = await call('PATCH', `/api/tutorials/${id}`, { title: 'Renamed', updated_at: await updatedAt(id) })
      expect(res.status, await res.clone().text()).toBe(200)
      expect((await adminClient().from('tutorials').select('status, title').eq('id', id).single()).data).toEqual({ status: 'pending', title: 'Renamed' })
      const { count } = await adminClient().from('notifications').select('id', { count: 'exact', head: true })
        .eq('tutorial_id', id).eq('type', 'tutorial_submitted').eq('recipient_id', reviewer.id)
      expect(count).toBe(1)
    } finally {
      await deleteTestUser(reviewer.id)
    }
  })

  it('WT18 an admin editing someone else\'s approved guide leaves it approved', async () => {
    const admin = await createTestUser('admin')
    try {
      const id = await published()
      const res = await app.request(`/api/tutorials/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${admin.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Fixed by admin', updated_at: await updatedAt(id) }),
      })
      expect(res.status, await res.clone().text()).toBe(200)
      expect((await adminClient().from('tutorials').select('status, title').eq('id', id).single()).data).toEqual({ status: 'approved', title: 'Fixed by admin' })
    } finally {
      await deleteTestUser(admin.id)
    }
  })

  it('WT18 a status-less edit by someone who is not a contributor is refused and changes nothing', async () => {
    const id = await published()
    const stranger = await createTestUser('contributor')
    try {
      const res = await app.request(`/api/tutorials/${id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${stranger.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: 'Hijacked', updated_at: await updatedAt(id) }),
      })
      expect(res.status).toBe(403)
      expect((await adminClient().from('tutorials').select('title').eq('id', id).single()).data).toEqual({ title: 'Backing Fixture' })
    } finally {
      await deleteTestUser(stranger.id)
    }
  })

  it('WT18 moving an approved guide to draft is a conflict that names the way back', async () => {
    const id = await published()
    const res = await call('PATCH', `/api/tutorials/${id}`, { status: 'draft', updated_at: await updatedAt(id) })
    expect(res.status).toBe(409)
    expect(await res.json()).toEqual({ error: 'Guide is approved; submit for re-review' })
    expect(await statusOf(id)).toBe('approved')
  })
})

describe('the explicit status write moves a published guide back to pending', () => {
  it.each(['approved', 'rejected'] as const)('WT18 WT23 WT24 a details, photo or PDF write carrying status pending takes a %s guide to pending', async (before) => {
    const id = await published(before)
    const res = await call('PATCH', `/api/tutorials/${id}`, { title: 'Renamed', photo_urls: [], tutorial_pdf_url: `${id}/tutorial.pdf`, status: 'pending', updated_at: await updatedAt(id) })
    expect(res.status, await res.clone().text()).toBe(200)
    expect(await statusOf(id)).toBe('pending')
  })
})
