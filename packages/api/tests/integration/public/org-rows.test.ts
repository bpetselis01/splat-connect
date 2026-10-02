/** org-profile-rows: a backed guide names its author and its parts total. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, createProject, requestBacking, cleanupOrg } from '../../helpers/orgs.js'

let author: TestUser
let orgId: string
let priced: string
let unpriced: string

beforeAll(async () => {
  const admin = adminClient()
  author = await createTestUser()
  await admin.from('profiles').update({ name: 'Rachel Kaur' }).eq('id', author.id)
  orgId = await createOrg({ createdBy: author.id })
  priced = await createProject({ authorId: author.id, status: 'approved', title: 'Drum' })
  unpriced = await createProject({ authorId: author.id, status: 'approved', title: 'Fan' })
  for (const id of [priced, unpriced]) await requestBacking({ tutorialId: id, orgId, status: 'accepted' })
  await admin.from('parts').insert([
    { tutorial_id: priced, name: 'Switch', is_optional: false, price_cents: 1200 },
    { tutorial_id: priced, name: 'Jack', is_optional: false, price_cents: 1200 },
    { tutorial_id: priced, name: 'Glitter', is_optional: true, price_cents: null },
    { tutorial_id: unpriced, name: 'Fan', is_optional: false, price_cents: null },
  ])
})

afterAll(async () => {
  await cleanupOrg(orgId, [priced, unpriced])
  await deleteTestUser(author.id)
})

describe('GET /api/public/organizations/:id — guide rows', () => {
  it('names the author and totals the required parts, and hides a total with an unpriced part', async () => {
    const body = (await (await app.request(`/api/public/organizations/${orgId}`)).json()) as {
      tutorialsBacked: Array<{ id: string; author_name: string | null; parts_total_cents: number | null }>
    }
    expect(body.tutorialsBacked.find((t) => t.id === priced)).toMatchObject({ author_name: 'Rachel Kaur', parts_total_cents: 2400 })
    expect(body.tutorialsBacked.find((t) => t.id === unpriced)).toMatchObject({ parts_total_cents: null })
  })
})
