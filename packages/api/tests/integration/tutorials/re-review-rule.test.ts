// The re-review rule as it is today (Q8 in the requirements doc decides whether it stays).
// The API never moves a guide back to pending on its own. The web editor does, by adding
// status: 'pending' to the write for details, photos, PDF, prices-checked and customisation
// questions (packages/web/tests/unit/pages/edit-tutorial-actions.test.tsx). This file pins
// the API half: which writes leave a published guide published, and that the explicit
// status write is what moves it.
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

describe('writes that leave an approved guide approved', () => {
  it.each([
    ['parts', 'POST', (id: string) => [`/api/tutorials/${id}/parts`, { parts: [{ name: 'Jack', quantity: 1, is_optional: false, buy_links: [] }] }]],
    ['tools', 'POST', (id: string) => [`/api/tutorials/${id}/tools`, { tools: [{ name: 'Pliers', is_optional: false, buy_links: [] }] }]],
    ['steps', 'PUT', (id: string) => [`/api/tutorials/${id}/steps`, { steps: [{ body: 'Open it' }] }]],
    ['safety notes', 'POST', (id: string) => [`/api/tutorials/${id}/safety-notes`, { safety_notes: [{ title: 'Batteries', detail: null }] }]],
    ['recommendations', 'POST', (id: string) => [`/api/tutorials/${id}/recommendations`, { recommendations: [{ recommended_id: other, required: false }] }]],
    ['STL files', 'POST', (id: string) => [`/api/tutorials/${id}/stl-files`, { stl_files: [{ filename: 'a.stl', file_url: `${id}/a.stl` }] }]],
  ] as const)('WT19 WT21 WT25 WT26 WT27 WT29 %s keep an approved guide approved', async (_name, method, build) => {
    const id = await published()
    const [path, body] = build(id)
    const res = await call(method, path as string, body)
    expect(res.status, await res.clone().text()).toBeLessThan(300)
    expect(await statusOf(id)).toBe('approved')
  })

  // The row-level policy lets an author write a published guide only into pending, so a
  // details write that does not say so is refused (as a 500 today) and the guide is untouched.
  // That is why the web action adds status: 'pending' itself.
  it('WT18 a details write without a status is refused on an approved guide, which stays approved and unrenamed', async () => {
    const id = await published()
    const res = await call('PATCH', `/api/tutorials/${id}`, { title: 'Renamed', updated_at: await updatedAt(id) })
    expect(res.status).toBeGreaterThanOrEqual(400)
    const { data } = await adminClient().from('tutorials').select('status, title').eq('id', id).single()
    expect(data).toEqual({ status: 'approved', title: 'Backing Fixture' })
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
