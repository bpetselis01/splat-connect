/**
 * 112: the photo of the sorted plastic. A private bucket, a path pinned to the
 * contributor's own folder, signed reads for the contributor and the
 * organisation's leaders — and an account deletion that still completes.
 */
// journeys: V05
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import app from '../../../src/app.js'
import { createUserClient } from '../../../src/supabase/client.js'
import { DECLARATION_VERSION } from '@splat-connect/types'
import { createTestUser, deleteTestUser, adminClient, type TestUser } from '../../helpers/auth.js'
import { createOrg, addLeader } from '../../helpers/orgs.js'

const GHOST = '00000000-0000-4000-8000-00000000dead'
let leader: TestUser
let me: TestUser
let other: TestUser
let leaver: TestUser
let orgId: string

const json = (token: string, method: string, body?: unknown) => ({
  method,
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  ...(body === undefined ? {} : { body: JSON.stringify(body) }),
})
const booking = (photo_url: unknown) => ({
  material: 'PLA',
  estimated_grams: 2500,
  condition_declared: true,
  declaration_version: DECLARATION_VERSION,
  photo_url,
})
const png = () => new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'anything.exe', { type: 'image/png' })
const upload = (token: string, file: File) => {
  const fd = new FormData()
  fd.append('file', file)
  return app.request('/api/upload/recycling-photo', { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: fd })
}

beforeAll(async () => {
  ;[leader, me, other, leaver] = await Promise.all([1, 2, 3, 4].map(() => createTestUser('contributor')))
  orgId = await createOrg({ createdBy: leader.id })
  await addLeader(orgId, leader.id)
  await adminClient().from('organizations').update({ recycling_materials: ['PLA'] }).eq('id', orgId)
})

afterAll(async () => {
  const admin = adminClient()
  await admin.from('recycling_dropoffs').delete().eq('org_id', orgId)
  for (const u of [me, other, leaver]) {
    const { data } = await admin.storage.from('recycling-photos').list(u.id)
    if (data?.length) await admin.storage.from('recycling-photos').remove(data.map((f) => `${u.id}/${f.name}`))
  }
  await admin.from('organizations').delete().eq('id', orgId)
  await Promise.all([leader, me, other, leaver].map((u) => deleteTestUser(u.id).catch(() => {})))
})

describe('112 the recycling-photos bucket', () => {
  it('exists and is private', async () => {
    const { data } = await adminClient().storage.getBucket('recycling-photos')
    expect(data?.public).toBe(false)
  })
})

describe('POST /api/upload/recycling-photo', () => {
  it('writes under the caller’s folder, naming the file from its type', async () => {
    const res = await upload(me.token, png())
    expect(res.status).toBe(200)
    const body = (await res.json()) as { path: string; url: string }
    expect(body.path).toMatch(new RegExp(`^${me.id}/[0-9a-f-]{36}\\.png$`))
    expect(body.url).toContain('/object/sign/recycling-photos/')
  })

  it('refuses a file that is not a photo', async () => {
    const res = await upload(me.token, new File(['x'], 'a.png', { type: 'text/plain' }))
    expect(res.status).toBe(400)
  })

  it('will not let one member write into another’s folder', async () => {
    const { error } = await createUserClient(other.token)
      .storage.from('recycling-photos')
      .upload(`${me.id}/${crypto.randomUUID()}.png`, png())
    expect(error).not.toBeNull()
  })
})

describe('a booking with a photo', () => {
  let path: string
  let dropId: string

  beforeAll(async () => {
    path = ((await (await upload(me.token, png())).json()) as { path: string }).path
  })

  it('refuses a path in another member’s folder, or a URL', async () => {
    for (const bad of [`${other.id}/${crypto.randomUUID()}.png`, `https://evil.example/${me.id}/${crypto.randomUUID()}.png`]) {
      const res = await app.request(`/api/organizations/${orgId}/recycling`, json(me.token, 'POST', booking(bad)))
      expect(res.status).toBe(400)
      expect(((await res.json()) as { error: string }).error).toBe('That photo is not one you uploaded.')
    }
  })

  it('refuses the same on a direct insert (the CHECK)', async () => {
    const { error } = await createUserClient(me.token).from('recycling_dropoffs').insert({
      org_id: orgId,
      contributor_id: me.id,
      material: 'PLA',
      estimated_grams: 2500,
      condition_declared: true,
      declaration_version: DECLARATION_VERSION,
      photo_url: `${other.id}/${crypto.randomUUID()}.png`,
    })
    expect(error?.code).toBe('23514')
  })

  it('stores the path and signs it for the contributor and the leader', async () => {
    const res = await app.request(`/api/organizations/${orgId}/recycling`, json(me.token, 'POST', booking(path)))
    expect(res.status).toBe(201)
    const row = (await res.json()) as { id: string; photo_url: string }
    dropId = row.id
    expect(row.photo_url).toBe(path)

    const mine = (await (await app.request('/api/organizations/recycling/mine', json(me.token, 'GET'))).json()) as Array<{ id: string; photo_signed_url: string | null }>
    expect(mine.find((d) => d.id === dropId)?.photo_signed_url).toContain('/object/sign/recycling-photos/')

    const queue = (await (await app.request(`/api/organizations/${orgId}/recycling`, json(leader.token, 'GET'))).json()) as Array<{ id: string; photo_signed_url: string | null }>
    expect(queue.find((d) => d.id === dropId)?.photo_signed_url).toContain('/object/sign/recycling-photos/')
  })

  it('books without a photo exactly as before', async () => {
    const res = await app.request(`/api/organizations/${orgId}/recycling`, json(me.token, 'POST', booking(undefined)))
    expect(res.status).toBe(201)
    expect(((await res.json()) as { photo_url: string | null }).photo_url).toBeNull()
  })
})

describe('deleting an account that booked with a photo', () => {
  it('completes, clears the photo on the placeholder’s row, and empties the folder', async () => {
    const path = ((await (await upload(leaver.token, png())).json()) as { path: string }).path
    const booked = await app.request(`/api/organizations/${orgId}/recycling`, json(leaver.token, 'POST', booking(path)))
    const { id } = (await booked.json()) as { id: string }

    // A token minted seconds ago passes the route's fresh-sign-in check.
    const res = await app.request('/api/me', json(leaver.token, 'DELETE', { confirm: 'DELETE', keepCredit: false }))
    expect(res.status).toBeLessThan(300)

    const { data: row } = await adminClient().from('recycling_dropoffs').select('contributor_id, photo_url').eq('id', id).single()
    expect(row).toEqual({ contributor_id: GHOST, photo_url: null })
    const { data: left } = await adminClient().storage.from('recycling-photos').list(leaver.id)
    expect(left ?? []).toHaveLength(0)
  })
})
