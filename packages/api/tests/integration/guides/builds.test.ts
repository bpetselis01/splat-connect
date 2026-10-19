import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createProject } from '../../helpers/orgs.js'

let author: TestUser
let parent: TestUser
let guide: string
let draft: string
const call = (method: string, path: string, token: string) => app.request(path, { method, headers: { Authorization: `Bearer ${token}` } })
const stamp = async () => (await adminClient().from('tutorials').select('updated_at').eq('id', guide).single()).data!.updated_at

beforeAll(async () => {
  author = await createTestUser('contributor')
  parent = await createTestUser('contributor')
  guide = await createProject({ authorId: author.id, status: 'approved', title: 'Builds Fixture' })
  draft = await createProject({ authorId: author.id, status: 'draft', title: 'Builds Draft Fixture' })
})
afterAll(async () => {
  await adminClient().from('tutorials').delete().in('id', [guide, draft])
  await deleteTestUser(author.id)
  await deleteTestUser(parent.id)
})

describe('091 tutorial_builds', () => {
  it('B03 WT10 logs a build once, however many taps, and counts it without touching the guide', async () => {
    const before = await stamp()
    expect((await call('POST', `/api/tutorials/${guide}/build`, parent.token)).status).toBe(201)
    expect((await call('POST', `/api/tutorials/${guide}/build`, parent.token)).status).toBe(201)
    const { data } = await adminClient().from('tutorials').select('builds_count, updated_at').eq('id', guide).single()
    expect(data).toEqual({ builds_count: 1, updated_at: before })
  })

  it('Q01 tells the member their own count, and nobody else whose builds they are', async () => {
    const mine = await call('GET', '/api/me/builds', parent.token)
    expect(await mine.json()).toEqual({ builds: 1 })
    expect(await (await call('GET', '/api/me/builds', author.token)).json()).toEqual({ builds: 0 })
  })

  it('refuses a guide that is not published', async () => {
    expect((await call('POST', `/api/tutorials/${draft}/build`, parent.token)).status).toBe(404)
  })

  it('takes a build back', async () => {
    expect((await call('DELETE', `/api/tutorials/${guide}/build`, parent.token)).status).toBe(204)
    expect(await (await call('GET', '/api/me/builds', parent.token)).json()).toEqual({ builds: 0 })
  })
})
