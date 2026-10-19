/**
 * The holder's suburb on a public toy, and never more. A person's comes from
 * their pickup columns through the admin client; an organisation's from its
 * public suburb (059). The street and postcode never leave the API.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, createOrgToy, cleanupOrg } from '../../helpers/orgs.js'

let person: TestUser
let quiet: TestUser
let orgId: string
let personToy: string
let quietToy: string
let orgToy: string

const publishedToy = async (ownerId: string) =>
  (
    await adminClient()
      .from('toys')
      .insert({ owner_id: ownerId, name: 'Drum', condition: 8, photo_urls: ['https://example.com/d.jpg'], offer_type: 'donation', status: 'published' })
      .select('id')
      .single()
  ).data!.id as string

beforeAll(async () => {
  person = await createTestUser('contributor')
  quiet = await createTestUser('contributor')
  const admin = adminClient()
  await admin
    .from('profiles')
    .update({ pickup_line1: '12 Secret St', pickup_suburb: 'Newtown', pickup_state: 'NSW', pickup_postcode: '2042' })
    .eq('id', person.id)
  personToy = await publishedToy(person.id)
  quietToy = await publishedToy(quiet.id)
  orgId = await createOrg({ createdBy: person.id })
  await admin
    .from('organizations')
    .update({ suburb: 'Newcastle', state: 'NSW', pickup_line1: '5 Private Rd', pickup_postcode: '2300' })
    .eq('id', orgId)
  orgToy = await createOrgToy({ orgId })
})

afterAll(async () => {
  await adminClient().from('toys').delete().in('id', [personToy, quietToy])
  await cleanupOrg(orgId)
  await deleteTestUser(person.id)
  await deleteTestUser(quiet.id)
})

const read = async (id: string) => {
  const res = await app.request(`/api/public/toys/${id}`)
  expect(res.status).toBe(200)
  return (await res.json()) as { holder_suburb: string | null; holder_state: string | null }
}

// Ids and timestamps carry digit runs of their own ("…-2042…", ".230017"); drop
// them so a postcode check can only match a postcode.
const withoutIdsOrTimes = (text: string) =>
  text
    .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g, '')
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+(?:Z|[+-]\d{2}:\d{2})?/g, '')

describe('holder location on a public toy', () => {
  it("Y04 gives a person's suburb and state, never their street or postcode", async () => {
    const res = await app.request(`/api/public/toys/${personToy}`)
    const text = await res.text()
    const body = JSON.parse(text) as { holder_suburb: string; holder_state: string }
    expect(body.holder_suburb).toBe('Newtown')
    expect(body.holder_state).toBe('NSW')
    expect(text).not.toContain('12 Secret St')
    expect(withoutIdsOrTimes(text)).not.toContain('2042')
  })

  it("gives an organisation's public suburb, never its pickup address", async () => {
    const res = await app.request(`/api/public/toys/${orgToy}`)
    const text = await res.text()
    expect(JSON.parse(text)).toMatchObject({ holder_suburb: 'Newcastle', holder_state: 'NSW' })
    expect(text).not.toContain('5 Private Rd')
    expect(withoutIdsOrTimes(text)).not.toContain('2300')
  })

  it('says nothing when the holder has not given a suburb', async () => {
    const body = await read(quietToy)
    expect(body.holder_suburb).toBeNull()
    expect(body.holder_state).toBeNull()
  })
})
